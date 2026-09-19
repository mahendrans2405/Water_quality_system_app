import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Rect,
  Line,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { api } from '../../src/api/client';
import { authStore } from '../../src/state/authStore';
import { CompanySelector } from '../../components/company-selector';
import { CornerDatePicker, type CornerRangeType } from '../../components/corner-date-picker';
import type { DeviceSummary, TelemetryRecord, FieldMapping } from '../../src/api/types';

export default function ChartsScreen() {
  const user = authStore((s) => s.user);
  const selectedCompanyId = authStore((s) => s.selectedCompanyId);
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width < 650;

  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedParamName, setSelectedParamName] = useState<string>('pH');
  const [range, setRange] = useState<CornerRangeType>('1d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [items, setItems] = useState<TelemetryRecord[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);

  // 1. Load devices
  async function loadDevices() {
    setDeviceLoading(true);
    try {
      const res = await api.get('/api/devices', {
        params: isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : undefined,
      });

      const list: DeviceSummary[] = res.data?.data || [];
      setDevices(list);
      if (list.length > 0 && (!selectedDeviceId || !list.some((d) => d.id === selectedDeviceId))) {
        setSelectedDeviceId(list[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load devices');
    } finally {
      setDeviceLoading(false);
    }
  }

  // 2. Load telemetry for chart
  async function loadTelemetry() {
    if (!selectedDeviceId) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params: any = { range };
      if (range === 'custom') {
        if (customStart) params.start = new Date(customStart).toISOString();
        if (customEnd) params.end = new Date(customEnd).toISOString();
        params.limit = 200;
      } else {
        params.limit = 200;
      }

      const res = await api.get(`/api/iot/devices/${selectedDeviceId}/telemetry`, {
        params,
      });

      if (res.data?.ok) {
        setItems(res.data.data.items || []);
        setFieldMappings(res.data.data.fieldMappings || []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, [selectedCompanyId, user?.companyId]);

  useEffect(() => {
    loadTelemetry();
  }, [selectedDeviceId, range]);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const activeMappings = useMemo(() => {
    if (fieldMappings.length > 0) return fieldMappings;
    return (
      selectedDevice?.fieldMappings || [
        { fieldNumber: 1, parameterName: 'pH', unit: 'pH', minThreshold: 6.5, maxThreshold: 8.5 },
        { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', minThreshold: 0, maxThreshold: 5.0 },
        { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', minThreshold: 0, maxThreshold: 500 },
      ]
    );
  }, [fieldMappings, selectedDevice]);

  // Keep selectedParamName valid when activeMappings changes
  useEffect(() => {
    if (
      activeMappings.length > 0 &&
      (!selectedParamName || !activeMappings.some((m) => m.parameterName.toLowerCase() === selectedParamName.toLowerCase()))
    ) {
      setSelectedParamName(activeMappings[0].parameterName);
    }
  }, [activeMappings, selectedParamName]);

  // Current active mapping for the single displayed graph
  const currentMapping = useMemo(() => {
    return (
      activeMappings.find(
        (m) => m.parameterName.toLowerCase() === selectedParamName.toLowerCase()
      ) || activeMappings[0]
    );
  }, [activeMappings, selectedParamName]);

  // Extract series data for current selected parameter
  const series = useMemo(() => {
    if (!currentMapping) return [];
    return items
      .map((it) => {
        const param = it.parameters?.[currentMapping.parameterName];
        if (param?.value === null || param?.value === undefined || typeof param.value !== 'number') {
          return null;
        }
        return {
          value: param.value,
          time: it.timestamp,
        };
      })
      .filter(Boolean) as { value: number; time: string }[];
  }, [items, currentMapping]);

  // Color & Icon helper for each parameter
  const getParamMeta = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('ph')) {
      return { color: '#2563eb', icon: '💧', bg: '#eff6ff' };
    }
    if (lower.includes('turbid')) {
      return { color: '#f59e0b', icon: '🌊', bg: '#fffbeb' };
    }
    if (lower.includes('tds')) {
      return { color: '#10b981', icon: '🔬', bg: '#ecfdf5' };
    }
    if (lower.includes('temp')) {
      return { color: '#ef4444', icon: '🌡️', bg: '#fef2f2' };
    }
    return { color: '#8b5cf6', icon: '📊', bg: '#f5f3ff' };
  };

  // Helper to extract mouse / touch X coordinate across Web & Native
  const getEventX = (event: any): number | null => {
    if (event?.nativeEvent) {
      if (typeof event.nativeEvent.locationX === 'number') {
        return event.nativeEvent.locationX;
      }
      if (typeof (event.nativeEvent as any).offsetX === 'number') {
        return (event.nativeEvent as any).offsetX;
      }
    }
    if (typeof (event as any)?.clientX === 'number' && event?.currentTarget?.getBoundingClientRect) {
      const rect = event.currentTarget.getBoundingClientRect();
      return (event as any).clientX - rect.left;
    }
    return null;
  };

  // Compute graph geometry
  const currentWidth = chartWidth > 100 ? chartWidth : Math.max(300, width - 40);
  const chartHeight = 240;
  const padding = { top: 25, right: 25, bottom: 35, left: 52 };
  const plotW = Math.max(50, currentWidth - padding.left - padding.right);
  const plotH = chartHeight - padding.top - padding.bottom;

  const minThresh = currentMapping?.minThreshold;
  const maxThresh = currentMapping?.maxThreshold;

  const values = series.map((p) => p.value);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 10;
  let minVal = Math.min(rawMin, minThresh !== null && minThresh !== undefined ? minThresh : rawMin);
  let maxVal = Math.max(rawMax, maxThresh !== null && maxThresh !== undefined ? maxThresh : rawMax);

  if (minVal === maxVal) {
    minVal -= 1;
    maxVal += 1;
  } else {
    const buffer = (maxVal - minVal) * 0.08;
    minVal -= buffer;
    maxVal += buffer;
  }
  const rangeVal = maxVal - minVal || 1;

  // Compute points in pixel coordinates
  const points = useMemo(() => {
    return series.map((point, index) => {
      const x =
        series.length === 1
          ? padding.left + plotW / 2
          : padding.left + (index / (series.length - 1)) * plotW;
      const y = padding.top + plotH - ((point.value - minVal) / rangeVal) * plotH;
      return { x, y, time: point.time, value: point.value, index };
    });
  }, [series, plotW, plotH, minVal, rangeVal]);

  const activeIdx = selectedIndex ?? Math.max(0, points.length - 1);
  const selectedPoint = points[activeIdx] || points[points.length - 1] || null;

  // Update nearest point based on cursor / touch position
  const setNearestPoint = (touchX: number) => {
    if (!points.length) return;
    let nearestIdx = 0;
    let minDist = Number.MAX_SAFE_INTEGER;
    points.forEach((p, idx) => {
      const d = Math.abs(p.x - touchX);
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    });
    setSelectedIndex(nearestIdx);
  };

  // SVG Paths
  const linePathD = points.length
    ? points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : '';
  const firstX = points.length ? points[0].x.toFixed(1) : '0';
  const lastX = points.length ? points[points.length - 1].x.toFixed(1) : '0';
  const bottomY = (padding.top + plotH).toFixed(1);
  const areaPathD = points.length
    ? `M ${firstX} ${bottomY} L ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} L ${lastX} ${bottomY} Z`
    : '';

  // 5 Horizontal Grid Levels
  const yTicks = [0, 1, 2, 3, 4].map((step) => {
    const ratio = step / 4;
    const val = maxVal - ratio * rangeVal;
    const y = padding.top + ratio * plotH;
    return { val, y };
  });

  // Vertical Grid Lines (4 or 5 lines)
  const vGridCount = Math.min(6, Math.max(3, Math.round(plotW / 90)));
  const vTicks = Array.from({ length: vGridCount }).map((_, idx) => {
    return padding.left + (idx / (vGridCount - 1)) * plotW;
  });

  // X-Axis Date/Time Labels
  const xLabelTicks = [0, 0.25, 0.5, 0.75, 1.0]
    .map((ratio) => {
      const targetIdx = Math.min(points.length - 1, Math.round(ratio * (points.length - 1)));
      const pt = points[targetIdx];
      if (!pt) return null;
      const d = new Date(pt.time);
      const text = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { x: pt.x, text };
    })
    .filter(Boolean) as { x: number; text: string }[];

  const dotInterval = Math.max(1, Math.ceil(points.length / 10));

  const activeColor = getParamMeta(currentMapping?.parameterName || '').color;
  const gradientId = `grad_single_chart_${(currentMapping?.parameterName || 'param').replace(/[^a-zA-Z0-9]/g, '_')}`;

  const dateRangeStr =
    series.length > 0
      ? `${new Date(series[0].time).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })} - ${new Date(series[series.length - 1].time).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        })}`
      : '';

  const isCurrentAlert =
    selectedPoint &&
    ((minThresh !== null && minThresh !== undefined && selectedPoint.value < minThresh) ||
      (maxThresh !== null && maxThresh !== undefined && selectedPoint.value > maxThresh));

  // Function to download the graph directly as a high-resolution PNG image
  const handleDownloadImage = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Download', 'Image download is supported on web browsers.');
      return;
    }

    setDownloading(true);
    try {
      const svgContainer = document.getElementById('single-param-chart-wrapper');
      const svg = svgContainer ? svgContainer.querySelector('svg') : document.querySelector('svg');

      if (!svg) {
        alert('Could not find chart element to export.');
        setDownloading(false);
        return;
      }

      let svgData = new XMLSerializer().serializeToString(svg);
      if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svgData = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const canvas = document.createElement('canvas');
      const scale = 2; // 2x resolution for sharp print/export quality
      const bWidth = svg.clientWidth || currentWidth || 600;
      const bHeight = svg.clientHeight || chartHeight || 240;
      canvas.width = bWidth * scale;
      canvas.height = bHeight * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setDownloading(false);
        return;
      }

      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, bWidth, bHeight);

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${selectedParamName.replace(/\s+/g, '_')}_graph_${Date.now()}.png`;
        downloadLink.href = pngUrl;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        setDownloading(false);
      };

      img.onerror = () => {
        setDownloading(false);
        alert('Failed to generate image from chart.');
      };

      img.src = url;
    } catch (e: any) {
      setDownloading(false);
      console.error('Download error:', e);
      alert('Download error: ' + (e?.message || e));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { maxWidth: 1080, width: '100%', alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
        {/* Header & Corner Date Picker (One Day, One Week, One Month, Custom) */}
        <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
          <View style={{ flex: isMobile ? undefined : 1 }}>
            <Text style={styles.title}>IoT Telemetry Analytics</Text>
            <Text style={styles.subtitle}>
              Interactive parameter curve with real-time cursor hover.
            </Text>
          </View>

          {/* Corner Date Selection: One Day, One Week, One Month, Custom */}
          <CornerDatePicker
            range={range}
            onRangeChange={(newRange) => {
              setRange(newRange);
              setSelectedIndex(null);
            }}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            onApplyCustom={() => {
              loadTelemetry();
              setSelectedIndex(null);
            }}
            onReset={() => {
              setCustomStart('');
              setCustomEnd('');
              setRange('1d');
              setSelectedIndex(null);
            }}
            loading={loading}
          />
        </View>

        {isSuperAdmin && <CompanySelector />}

        {/* Device Selector */}
        {deviceLoading ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : devices.length === 0 ? (
          <Text style={styles.noDeviceNotice}>No connected devices found.</Text>
        ) : (
          <View style={styles.deviceTabsWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deviceTabs}>
              {devices.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.deviceTab, selectedDeviceId === d.id && styles.deviceTabActive]}
                  onPress={() => {
                    setSelectedDeviceId(d.id);
                    setSelectedIndex(null);
                  }}
                >
                  <Text style={[styles.deviceTabText, selectedDeviceId === d.id && styles.deviceTabTextActive]}>
                    {d.name || d.deviceId}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* METRIC SELECTOR TABS: Click pH, Turbidity, TDS to switch graph */}
        <View style={styles.paramSelectorSection}>
          <Text style={styles.controlLabel}>Select Sensor Metric (Single Graph):</Text>
          <View style={styles.paramTabsRow}>
            {activeMappings.map((m) => {
              const isSelected = m.parameterName.toLowerCase() === selectedParamName.toLowerCase();
              const meta = getParamMeta(m.parameterName);

              // Get latest reading value for this parameter if available
              const latestItem = items.length ? items[items.length - 1] : null;
              const latestVal = latestItem?.parameters?.[m.parameterName]?.value;

              return (
                <TouchableOpacity
                  key={m.parameterName}
                  style={[
                    styles.paramTab,
                    isSelected && {
                      backgroundColor: meta.color,
                      borderColor: meta.color,
                      shadowColor: meta.color,
                      shadowOpacity: 0.3,
                      shadowRadius: 5,
                      shadowOffset: { width: 0, height: 2 },
                    },
                  ]}
                  onPress={() => {
                    setSelectedParamName(m.parameterName);
                    setSelectedIndex(null);
                  }}
                >
                  <Text style={styles.paramIcon}>{meta.icon}</Text>
                  <View>
                    <Text style={[styles.paramTabText, isSelected && styles.paramTabTextActive]}>
                      {m.parameterName}
                    </Text>
                    {latestVal !== null && latestVal !== undefined && (
                      <Text style={[styles.paramTabVal, isSelected && styles.paramTabValActive]}>
                        {latestVal} {m.unit}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading && <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 20 }} />}

        {/* SINGLE GRAPH DISPLAY */}
        {!loading && series.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No {currentMapping?.parameterName || ''} telemetry feeds recorded in this time range.
            </Text>
          </View>
        ) : (
          <View style={styles.chartWrapper} id="single-param-chart-wrapper">
            {/* Top Header Row matching Image 2 + DOWNLOAD BUTTON */}
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderLeft}>
                <Text style={styles.chartLabel}>
                  {currentMapping?.parameterName} {currentMapping?.unit ? `(${currentMapping.unit})` : ''}
                </Text>
                {selectedPoint && (
                  <View style={[styles.badgePill, { backgroundColor: `${activeColor}18` }]}>
                    <Text style={[styles.badgePillText, { color: activeColor }]}>
                      {selectedPoint.value} {currentMapping?.unit}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.chartHeaderRight}>
                {/* Download Graph as Image Button */}
                <TouchableOpacity
                  style={styles.downloadImgBtn}
                  onPress={handleDownloadImage}
                  disabled={downloading}
                >
                  <Text style={styles.downloadImgBtnText}>
                    {downloading ? 'Exporting...' : '📷 Download Graph'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hover instruction badge */}
            <View style={styles.hoverHintRow}>
              <Text style={styles.hoverHintText}>
                💡 Hover your cursor across the chart to inspect point-by-point values in real time.
              </Text>
            </View>

            {/* SVG Area Chart with Real-Time Cursor Hover */}
            <Pressable
              onLayout={(event) => {
                const w = event.nativeEvent.layout.width;
                if (w > 50 && w !== chartWidth) {
                  setChartWidth(w);
                }
              }}
              onPointerMove={(event) => {
                const locX = getEventX(event);
                if (locX !== null) {
                  setNearestPoint(locX);
                }
              }}
              onPress={(event) => {
                const locX = getEventX(event);
                if (locX !== null) {
                  setNearestPoint(locX);
                }
              }}
              style={[
                styles.chartContainer,
                Platform.OS === 'web' && ({ cursor: 'crosshair' } as any),
              ]}
            >
              <Svg width="100%" height={chartHeight} viewBox={`0 0 ${currentWidth} ${chartHeight}`}>
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={activeColor} stopOpacity={0.28} />
                    <Stop offset="90%" stopColor={activeColor} stopOpacity={0.02} />
                    <Stop offset="100%" stopColor={activeColor} stopOpacity={0.0} />
                  </LinearGradient>
                </Defs>

                {/* Background */}
                <Rect x="0" y="0" width={currentWidth} height={chartHeight} fill="#ffffff" />

                {/* Horizontal Grid & Y-Axis Labels */}
                {yTicks.map((yt, idx) => (
                  <React.Fragment key={`ytick-${idx}`}>
                    <Line
                      x1={padding.left}
                      y1={yt.y}
                      x2={currentWidth - padding.right}
                      y2={yt.y}
                      stroke="#f1f5f9"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={padding.left - 8}
                      y={yt.y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94a3b8"
                      fontWeight="600"
                    >
                      {yt.val >= 100 ? Math.round(yt.val) : yt.val.toFixed(2)}
                    </SvgText>
                  </React.Fragment>
                ))}

                {/* Vertical Grid Lines */}
                {vTicks.map((vx, idx) => (
                  <Line
                    key={`vtick-${idx}`}
                    x1={vx}
                    y1={padding.top}
                    x2={vx}
                    y2={padding.top + plotH}
                    stroke="#f8fafc"
                    strokeWidth={1}
                  />
                ))}

                {/* Min Threshold reference line */}
                {minThresh !== null && minThresh !== undefined && minThresh >= minVal && minThresh <= maxVal && (
                  <Line
                    x1={padding.left}
                    y1={padding.top + plotH - ((minThresh - minVal) / rangeVal) * plotH}
                    x2={currentWidth - padding.right}
                    y2={padding.top + plotH - ((minThresh - minVal) / rangeVal) * plotH}
                    stroke="#fca5a5"
                    strokeDasharray="4,4"
                    strokeWidth={1.2}
                  />
                )}

                {/* Max Threshold reference line */}
                {maxThresh !== null && maxThresh !== undefined && maxThresh >= minVal && maxThresh <= maxVal && (
                  <Line
                    x1={padding.left}
                    y1={padding.top + plotH - ((maxThresh - minVal) / rangeVal) * plotH}
                    x2={currentWidth - padding.right}
                    y2={padding.top + plotH - ((maxThresh - minVal) / rangeVal) * plotH}
                    stroke="#fca5a5"
                    strokeDasharray="4,4"
                    strokeWidth={1.2}
                  />
                )}

                {/* Translucent Area Fill below Curve */}
                <Path d={areaPathD} fill={`url(#${gradientId})`} />

                {/* The Crisp Line Curve */}
                <Path
                  d={linePathD}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Active Point Vertical Guide Line (Tracks cursor hover) */}
                {selectedPoint && (
                  <Line
                    x1={selectedPoint.x}
                    y1={padding.top}
                    x2={selectedPoint.x}
                    y2={padding.top + plotH}
                    stroke={activeColor}
                    strokeDasharray="3,3"
                    strokeWidth={1.4}
                    strokeOpacity={0.7}
                  />
                )}

                {/* Landmark Circular Dots (Image 2 style) */}
                {points.map((p, idx) => {
                  const isLandmark = idx % dotInterval === 0 || idx === points.length - 1;
                  const isSelected = selectedPoint && selectedPoint.index === p.index;
                  if (!isLandmark && !isSelected) return null;

                  if (isSelected) {
                    return (
                      <Circle
                        key={`dot-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={6.5}
                        fill={activeColor}
                        stroke="#ffffff"
                        strokeWidth={2.5}
                      />
                    );
                  }

                  return (
                    <Circle
                      key={`dot-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={3.5}
                      fill="#ffffff"
                      stroke={activeColor}
                      strokeWidth={2}
                    />
                  );
                })}

                {/* X-Axis Time Ticks */}
                {xLabelTicks.map((t, idx) => (
                  <SvgText
                    key={`xtick-${idx}`}
                    x={t.x}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#94a3b8"
                    fontWeight="500"
                  >
                    {t.text}
                  </SvgText>
                ))}
              </Svg>

              {/* Floating Real-Time Hover Tooltip */}
              {selectedPoint && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tooltip,
                    {
                      left: Math.min(
                        currentWidth - 140,
                        Math.max(padding.left, selectedPoint.x - 60)
                      ),
                      top: Math.max(10, selectedPoint.y - 58),
                    },
                  ]}
                >
                  <Text style={[styles.tooltipVal, { color: activeColor }]}>
                    {selectedPoint.value} {currentMapping?.unit}
                  </Text>
                  <Text style={styles.tooltipTime}>
                    {new Date(selectedPoint.time).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </Text>
                  {isCurrentAlert ? (
                    <Text style={styles.tooltipAlert}>⚠️ Alert: Exceeds Threshold</Text>
                  ) : (
                    <Text style={styles.tooltipSafe}>✓ Safe / Normal</Text>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  noDeviceNotice: {
    color: '#64748b',
    fontSize: 13,
    fontStyle: 'italic',
  },
  deviceTabsWrapper: {
    gap: 4,
  },
  deviceTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  deviceTab: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deviceTabActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  deviceTabText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  deviceTabTextActive: {
    color: '#fff',
  },
  paramSelectorSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 8,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  paramTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  paramIcon: {
    fontSize: 16,
  },
  paramTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  paramTabTextActive: {
    color: '#ffffff',
  },
  paramTabVal: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  paramTabValActive: {
    color: '#f1f5f9',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
  },
  chartWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  downloadImgBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  downloadImgBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  hoverHintRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hoverHintText: {
    fontSize: 11,
    color: '#64748b',
  },
  chartContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  tooltipVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  tooltipTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  tooltipAlert: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 3,
  },
  tooltipSafe: {
    fontSize: 9,
    color: '#16a34a',
    fontWeight: '700',
    marginTop: 3,
  },
});
