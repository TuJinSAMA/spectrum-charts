import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { ceil, floor } from 'lodash'
import Highcharts from 'highcharts'

let instanceOfMap = new Map()

const SpectrumChart = React.forwardRef(
  (
    {
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
    const spectrumRef = useRef(null)
    const [state, setState] = useState({
      xAxisMin: 0,
      xAxisMax: 0,
      isFirstRender: true,
    })
    const [keySymbol, setKeySymbol] = useState(null)

    useEffect(() => {
      console.log('init', keySymbol)
      setKeySymbol(Symbol())
    }, [])

    useEffect(() => {
      keySymbol && createChart()
    }, [keySymbol])

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
    const updateChart = res => {
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
      const spectrumChart = getChartInstance()
      if (state.isFirstRender) {
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
        resetChart()
      }
      // 插入数据重新渲染
      if (!spectrumChart.series) return
      spectrumChart.series[0].setData(resultData, true, false)
    }

    useImperativeHandle(ref, () => ({
      updateChart: updateChart,
    }))

    // 重新绘制
    const resetChart = () => {
      const spectrumChart = getChartInstance()
      if (spectrumChart) {
        spectrumChart.destroy()
        createChart()
      }
    }

    return <div style={{ height: height }} ref={spectrumRef}></div>
  }
)

export default SpectrumChart
