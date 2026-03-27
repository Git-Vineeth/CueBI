'use client'

import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import { Download } from 'lucide-react'
import type { ChartConfig } from '@/types'

// BharatBI brand colors for ECharts
const BRAND_COLORS = [
  '#ff6b35', '#0d7377', '#1a2e4a', '#27ae60',
  '#f39c12', '#8e44ad', '#2980b9', '#e74c3c',
]

interface Props {
  chart: ChartConfig
  height?: number
}

export default function Chart({ chart, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef  = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (chart.chart_type === 'table') return

    const instance = echarts.init(containerRef.current, undefined, { renderer: 'canvas' })
    instanceRef.current = instance

    const option = {
      color: BRAND_COLORS,
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 },
      grid: { left: '8%', right: '5%', top: '10%', bottom: '12%', containLabel: true },
      ...chart.echarts_option,
    }
    instance.setOption(option)

    const ro = new ResizeObserver(() => instance.resize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      instance.dispose()
    }
  }, [chart])

  function downloadPNG() {
    if (!instanceRef.current) return
    const url = instanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
    const a = document.createElement('a')
    a.href = url
    a.download = 'bharatbi_chart.png'
    a.click()
  }

  if (chart.chart_type === 'table') return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Chart header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700 truncate">{chart.title}</span>
        <button
          onClick={downloadPNG}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-2"
        >
          <Download size={12} />
          PNG
        </button>
      </div>
      {/* ECharts canvas */}
      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  )
}