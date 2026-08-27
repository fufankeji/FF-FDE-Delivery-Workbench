export const northlightTheme = {
  backgroundColor: "transparent",
  color: ["#d98632", "#d6b27b", "#7fa475", "#b86145", "#5f91b1", "#8d6f8a"],
  textStyle: {
    color: "#b7b1a8",
    fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  title: { textStyle: { color: "#f4f1eb" }, subtextStyle: { color: "#7e7a74" } },
  legend: { textStyle: { color: "#b7b1a8" } },
  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(239,229,215,.16)" } },
    axisTick: { show: false },
    axisLabel: { color: "#8f8a83" },
    splitLine: { lineStyle: { color: "rgba(239,229,215,.07)" } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#8f8a83" },
    splitLine: { lineStyle: { color: "rgba(239,229,215,.07)" } },
  },
  tooltip: {
    backgroundColor: "rgba(16,18,19,.96)",
    borderColor: "rgba(240,177,99,.28)",
    textStyle: { color: "#f4f1eb" },
  },
} as const;

