<template>
  <div :style="getHeight" ref="spectrogram"></div>
</template>
<script>
import { ceil, floor } from 'lodash'
import Highcharts from 'highcharts'
import scalable from '@/plugins/highCharts/scalable-yaxis'
import { dynamicDivide } from '@/utils/filters'
import useAppStore from '@/store/modules/app'

let instanceOfMap = new Map()
export default {
  data() {
    return {
      data: [], // 当前缓存的数据
      chart: null, // 保存 chart 实例
      chartInterval: null, // 保存渲染 chart 定时器
      xAxisMin: 0,
      xAxisMax: 0,
      isFirstRender: true,
      createdBegin: false,
      maximum: [],
      minimum: [],
      initMax: false,
      initMin: false,
      keySymbol: Symbol(),
    }
  },
  props: {
    zoomType: { type: String, default: 'x' },
    yAxisVisible: { type: Boolean, default: true },
    xAxisVisible: { type: Boolean, default: true },
    selection: { type: Boolean, default: true },
    color: { type: String, default: '#15CDE4' },
    backgroundColor: { type: String, default: 'rgba(0,0,0,0)' },
    height: { type: Number, default: 50 },
    pointCount: { type: Number, default: 1024 },
    spacingBottom: { type: Number, default: 25 },
    spacingLeft: { type: Number, default: 10 },
    spacingRight: { type: Number, default: 3 },
    spacingTop: { type: Number, default: 20 },
    yAxisMin: { type: Number, default: 1000 },
    yAxisMax: { type: Number, default: -1000 },
    marginBottom: { type: Number, default: 30 },
    yTitle: { type: String, default: '电平(dBuv)' },
  },
  computed: {
    getHeight() {
      return `height: ${this.height}px;`
    },
  },
  watch: {
    height(newValue) {
      const spectrumChart = this.getChartInstance()
      spectrumChart && spectrumChart.update({ chart: { height: newValue } })
    },
  },
  mounted() {
    this.createChart()
    const appStore = useAppStore()
    appStore.$subscribe(({events}) => {
      if (events.key === 'opened' || events.key === 'withoutAnimation') {
        setTimeout(() => {
          const spectrumChart = this.getChartInstance()
          spectrumChart.reflow()
        }, 500)
      }
    })
  },
  methods: {
    // 获取 highcharts 组件的实例
    getChartInstance() {
      return instanceOfMap.get(this.keySymbol)
    },
    // 设置 highcharts 组件的实例
    setChartInstance(value) {
      return instanceOfMap.set(this.keySymbol, value)
    },
    // 选择文件后给出的 true
    isTrue(data) {
      this.createdBegin = data
    },
    // 创建 chart 实例,并渲染到页面
    createChart() {
      // scalable(Highcharts)
      const config = {
        colors: [this.color],
        chart: {
          zoomType: this.zoomType,
          animation: false,
          backgroundColor: this.backgroundColor,
          spacingBottom: this.spacingBottom,
          spacingLeft: this.spacingLeft,
          spacingRight: this.spacingRight,
          spacingTop: this.spacingTop,
          marginBottom: this.marginBottom,
          // 隐藏 resetZoom
          resetZoomButton: {
            position: { x: 1000 },
          },
          events: {
            selection: event => {
              event.preventDefault()
              if (!this.selection) return
              this.drawSelection(event)
            },
            // 点击取消截取频段
            click: event => {
              event.preventDefault()
              this.removeActivePlotLine()
              this.$emit('cancelSelection')
            },
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
          visible: this.yAxisVisible,
          max: this.yAxisMax,
          min: this.yAxisMin,
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
            text: this.yTitle,
            style: {
              color: '#fff',
            },
          },
        },
        xAxis: {
          // 网格线最下方线的颜色
          lineColor: '#4F4F4F',
          visible: this.xAxisVisible,
          minRange: (this.xAxisMax - this.xAxisMin) * 0.01,
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
      const spectrumChart = new Highcharts.Chart(this.$refs.spectrogram, config)
      this.setChartInstance(spectrumChart)
    },
    // 使用定时器 渲染每一帧图像
    addData(res) {
      let totalData = res.data
      if (this.initMax) {
        // 显示折线图最大值的数据
        if (this.maximum.length == 0) {
          this.maximum = JSON.parse(JSON.stringify(totalData))
        } else {
          // 如果maximum不为空的话就判断它是否等于data的长度，不等于的话就让他等于空，这样就会重新开始刷新，就不会出现切换频率线长度不够的问题了
          if (this.maximum.length == totalData.length) {
            let isData = []
            for (let i = 0; i < totalData.length; i++) {
              if (totalData[i] > this.maximum[i]) {
                isData.push(totalData[i])
              } else {
                isData.push(this.maximum[i])
              }
            }
            this.maximum = isData
          } else {
            this.maximum = []
          }
        }
      }
      if (this.initMin) {
        // 显示折线图最小值的数据
        if (this.minimum.length == 0) {
          this.minimum = JSON.parse(JSON.stringify(totalData))
        } else {
          if (this.minimum.length == totalData.length) {
            let isData2 = []
            for (let i = 0; i < totalData.length; i++) {
              if (totalData[i] < this.minimum[i]) {
                isData2.push(totalData[i])
              } else {
                isData2.push(this.minimum[i])
              }
            }
            this.minimum = isData2
          } else {
            this.minimum = []
          }
        }
      }
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
      // 最大值线的数据
      const resultDataMax = this.maximum.map((currentValue, index) => {
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
      // 最小值线的数据
      const resultDataMin = this.minimum.map((currentValue, index) => {
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
      if (this.initMax) {
        // 最大值展示的线
        spectrumChart.series[1].setData(resultDataMax, true, false)
      } else {
        spectrumChart.series[1].setData()
      }
      if (this.initMin) {
        // 最小值展示的线
        spectrumChart.series[2].setData(resultDataMin, true, false)
      } else {
        spectrumChart.series[2].setData()
      }
    },
    // 点击显示最大值返回的 true
    mostMax(data) {
      this.initMax = data
    },
    // 点击显示最小值返回的 true
    mostMin(data) {
      this.initMin = data
    },
    // 点击取消截取频段
    removeActivePlotLine() {
      const spectrumChart = this.getChartInstance()
      spectrumChart.xAxis[0].removePlotLine('plotLine')
      spectrumChart.xAxis[0].removePlotBand('plotBand')
    },
    // 绘制选中区域
    drawSelection(event) {
      const min = event.xAxis[0].min
      const max = event.xAxis[0].max
      const center = (max + min) / 2
      const spectrumChart = this.getChartInstance()
      spectrumChart.xAxis[0].removePlotLine('plotLine')
      spectrumChart.xAxis[0].addPlotLine({
        value: center,
        color: 'red',
        width: 1,
        id: 'plotLine',
        className: 'spectrum_select_box'
      })
      this.setPlotBands(min, max, center)
      this.$emit('drawSelection', { min, max, center, type: 'SPECTRUM' })
    },
    // 重新绘制
    reload(isSave) {
      const spectrumChart = this.getChartInstance()
      if (spectrumChart) {
        spectrumChart.destroy()
        this.createChart()
      }
      if (isSave) {
        spectrumChart.series[0].setData(this.data, true, false)
      }
    },
    // 绘制选择区域
    setPlotBands(from, to, center) {
      const spectrumChart = this.getChartInstance()
      const centerFrequency = dynamicDivide(center, 1e6, 'MHz', 6)
      const bandWidth = dynamicDivide(to - from, 1e3, 'kHz', 6)
      spectrumChart.xAxis[0].removePlotBand('plotBand')
      spectrumChart.xAxis[0].addPlotBand({
        from,
        to,
        color: 'rgba(153, 153, 153, .6)',
        id: 'plotBand',
        label: {
          text: `中心频率：${centerFrequency} <br/> 带宽：${bandWidth}`,
          align: 'center',
          y: 12,
          useHTML: false,
          style: {
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '12px',
          },
        },
        zIndex: 4,
        borderColor: 'red',
        borderWidth: 1
      })
    },
  },
}
</script>
