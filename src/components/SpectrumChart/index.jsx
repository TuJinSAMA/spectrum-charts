import React, { useState, useEffect, useRef } from 'react'
import { ceil, floor } from 'lodash'
import Highcharts from 'highcharts'

let instanceOfMap = new Map()

const SpectrumChart = ({
  zoomType = 'x',
  yAxisVisible = true,
  xAxisVisible = true,
  selection = true,
  color = '#15CDE4',
  backgroundColor = 'rgba(0,0,0,0)',
  height = 50,
  pointCount = 1024,
  spacingBottom = 25,
  spacingLeft = 10,
  spacingRight = 3,
  spacingTop = 20,
  yAxisMin = 1000,
  yAxisMax = -1000,
  marginBottom = 30,
  yTitle = '电平(dBuv)',
}) => {
  const spectrumRef = useRef(null)
  let data = [] // 当前缓存的数据
  let chart = null // 保存 chart 实例
  let chartInterval = null // 保存渲染 chart 定时器
  let xAxisMin = 0
  let xAxisMax = 0
  let isFirstRender = true
  let createdBegin = false
  let maximum = []
  let minimum = []
  let initMax = false
  let initMin = false
  let keySymbol = Symbol()

  // 获取 highcharts 组件的实例
  const getChartInstance = () => {
    return instanceOfMap.get(keySymbol)
  }
  // 设置 highcharts 组件的实例
  const setChartInstance = value => {
    return instanceOfMap.set(keySymbol, value)
  }
  // 创建 chart 实例,并渲染到页面
  const createChart = () => {
    const config = {
      colors: [color],
      chart: {
        zoomType: zoomType,
        animation: false,
        backgroundColor: backgroundColor,
        spacingBottom: spacingBottom,
        spacingLeft: spacingLeft,
        spacingRight: spacingRight,
        spacingTop: spacingTop,
        marginBottom: marginBottom,
        // 隐藏 resetZoom
        resetZoomButton: {
          position: { x: 1000 },
        },
      },
      title: {
        floating: true,
        text: '',
      },
      credits: {
        enabled: false,
      },
      legend: {
        enabled: false,
      },
      yAxis: {
        // 网格线颜色
        gridLineColor: '#292929',
        visible: yAxisVisible,
        max: yAxisMax,
        min: yAxisMin,
        allowDecimals: false,
        tickInterval: 20,
        labels: {
          x: 0,
          y: 0,
          align: 'right',
          style: {
            color: '#fff',
          },
        },
        title: {
          text: yTitle,
          style: {
            color: '#fff',
          },
        },
      },
      xAxis: {
        // 网格线最下方线的颜色
        lineColor: '#4F4F4F',
        visible: xAxisVisible,
        minRange: (xAxisMax - xAxisMin) * 0.01,
        labels: {
          reserveSpace: false,
          autoRotation: false,
          style: {
            color: '#fff',
          },
          formatter: function () {
            return floor(this.value / 1e6, 2) + 'MHz'
          },
        },
        title: {
          text: null,
        },
        tickLength: 5,
      },
      boost: {
        useGPUTranslations: true,
      },
      tooltip: {
        enabled: false,
      },
      series: [
        {
          lineWidth: 1,
          enableMouseTracking: false,
          linecap: null,
          animation: false,
          turboThreshold: 3000,
          marker: {
            enabled: false,
          },
        },
        {
          // 最大值的线
          lineWidth: 1,
          enableMouseTracking: false,
          linecap: null,
          animation: false,
          turboThreshold: 3000,
          marker: {
            enabled: false,
          },
          lineColor: 'rgb(145, 18, 18)',
        },
        {
          // 最小值的线
          lineWidth: 1,
          enableMouseTracking: false,
          linecap: null,
          animation: false,
          turboThreshold: 3000,
          marker: {
            enabled: false,
          },
          lineColor: '#fff',
        },
      ],
    }
    const spectrumChart = new Highcharts.Chart(spectrumRef.current, config)
    setChartInstance(spectrumChart)
  }
  // 使用定时器 渲染每一帧图像
  const addData = res => {
    let totalData = res.data
    // 根据起始值与结束值计算每一个点的坐标
    if (!res.data) return
    const dataLength = res.data.length
    const resultData = res.data.map((currentValue, index) => {
      const x = ceil(
        res.startFrequency +
          ((res.stopFrequency - res.startFrequency) / dataLength) * index
      )
      const y = currentValue
      if (index === dataLength - 1) {
        return [res.stopFrequency, y]
      }
      return [x, y]
    })
    const spectrumChart = this.getChartInstance()
    if (this.isFirstRender) {
      spectrumChart.update({
        xAxis: {
          min: res.startFrequency,
          max: res.stopFrequency,
        },
      })
      this.xAxisMin = res.startFrequency
      this.xAxisMax = res.stopFrequency
      this.reload()
      this.isFirstRender = false
    }
    this.data = resultData
    // 插入数据重新渲染
    if (!spectrumChart.series) return
    spectrumChart.series[0].setData(resultData, true, false)
  }

  // 重新绘制
  const reload = () => {
    const spectrumChart = this.getChartInstance()
    if (spectrumChart) {
      spectrumChart.destroy()
      createChart()
    }
  }

  useEffect(() => {
    createChart()
  }, [])

  return <div style={{ height: height }} ref={spectrumRef}></div>
}

export default SpectrumChart
