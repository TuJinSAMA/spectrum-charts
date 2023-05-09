import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { ceil, floor } from 'lodash'
import Highcharts from 'highcharts'

// 当同一个页面存在多个频谱图时 使用 Map 数据结构存储 HighCharts 实例对象
let instanceOfMap = new Map()

const SpectrumChart = React.forwardRef(
  (
    {
      // 将一些配置项暴露给父组件，方便定制
      zoomType = 'x',
      yAxisVisible = true,
      xAxisVisible = true,
      color = '#15CDE4',
      backgroundColor = 'rgba(0,0,0,0)',
      height = 50,
      spacingBottom = 25,
      spacingLeft = 10,
      spacingRight = 3,
      spacingTop = 20,
      yAxisMin = 1000,
      yAxisMax = -1000,
      marginBottom = 30,
      yTitle = '电平(dBuv)',
    },
    ref
  ) => {
    const spectrumRef = useRef(null) // 图表 DOM 引用

    const [state, setState] = useState({
      xAxisMin: 0,
      xAxisMax: 0,
      isFirstRender: true,
    })

    const [keySymbol, setKeySymbol] = useState(null)

    useEffect(() => {
      // 每一个图表初始化之前先创建一个 symbol 作为 key
      // 然后将这个组件的图表的 HighCharts 实例对象 存放在 instanceOfMap 中
      setKeySymbol(Symbol())
    }, [])

    useEffect(() => {
      keySymbol && createChart()
    }, [keySymbol])

    // 获取 highcharts 组件的实例对象
    const getChartInstance = () => {
      return instanceOfMap.get(keySymbol)
    }
    // 设置 highcharts 组件的实例对象
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
          minRange: (state.xAxisMax - state.xAxisMin) * 0.01,
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
        ],
      }
      const spectrumChart = new Highcharts.Chart(spectrumRef.current, config)
      setChartInstance(spectrumChart)
    }
    // 更新渲染图表 暴露给父组件调用 传入图表的数据
    const updateChart = res => {
      if (!res.data) return
      const dataLength = res.data.length
      // 数据聚合
      const resultData = res.data.map((currentValue, index) => {
        // 根据起始值与结束值计算每一个点的坐标
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
      // 获取当前 chart 的实例对象
      const spectrumChart = getChartInstance()
      if (state.isFirstRender) {
        // 如果是第一次渲染 则设置横轴频率范围
        spectrumChart.update({
          xAxis: {
            min: res.startFrequency,
            max: res.stopFrequency,
          },
        })
        setState(s => ({
          ...s,
          xAxisMin: res.startFrequency,
          xAxisMax: res.stopFrequency,
          isFirstRender: false,
        }))
        // 重新绘制以达到更新效果
        resetChart()
      }
      // 将当前一帧的数据绘制在页面上
      spectrumChart.series[0].setData(resultData, true, false)
    }

    // 重新绘制 chart
    const resetChart = () => {
      const spectrumChart = getChartInstance()
      if (spectrumChart) {
        spectrumChart.destroy()
        createChart()
      }
    }

    useImperativeHandle(ref, () => ({
      updateChart: updateChart,
    }))

    return <div style={{ height: height }} ref={spectrumRef}></div>
  }
)

export default SpectrumChart
