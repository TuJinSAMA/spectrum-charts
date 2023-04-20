<template>
  <div class="heatmap" :style="styleText" ref="heatmap">
    <span>{{ title }}</span>
  </div>
</template>

<script>
import { nextTick } from 'vue'
import { round } from 'lodash'
import * as colormap from 'colormap'

export default {
  props: {
    title: { type: String, default: '瀑布图(dBuv)' },
    height: { type: Number, default: 50 },
    minDb: { type: Number, default: -125 },
    maxDb: { type: Number, default: 0 },
    legendWidth: { type: Number, default: 64 },
    padding: { type: Number, default: 2 },
    colormapName: { type: String, default: 'jet' },
    selection: { type: Boolean, default: true },
    fileData: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      canvas: null, // 实际用于渲染瀑布图的 canvas DOM
      canvasCtx: null, // 实际用于渲染瀑布图的 canvas context
      rangeCanvas: null, // 用于实现框选效果的 canvas DOM引用
      rangeCanvasCtx: null, // 用于实现框选效果的 canvas context
      fallsCanvas: null, // 用于保存已生成的瀑布图 canvas 引用
      fallsCanvasCtx: null, // 用于保存已生成的瀑布图 canvas context
      legendCanvasCtx: null, // 图例 canvas context
      canvasWidth: 0,
      colormap: [],
      isFirstRender: true,
      beginX: 0,
      beginY: 0,
      endX: 0,
      endY: 0,
      isDraw: false,
      chartScale: 0,
      startFrequency: 0,
      stopFrequency: 0,
      aggregationFrame: 1, // 聚合帧数
      fftSize: 2048, // 傅里叶参数
      dataList: [], // 已播放的瀑布图每一帧的数据(当前播放下标)
    }
  },
  computed: {
    styleText() {
      return `height: ${this.height}px;`
    },
  },
  watch: {
    height(newValue) {
      this.setCanvasStyle({ height: newValue })
      this.drawLegend()
    },
  },
  mounted() {
    if (this.$refs.heatmap.clientWidth <= 0) {
      nextTick(() => {
        this.initComponent()
      })
      return
    }
    this.initComponent()    
  },
  methods: {
    initComponent() {
      this.initColormap()
      this.createCanvas()
      this.createFallsCanvas()
      this.createRangeCanvas()
      this.createLegendCanvas()
      this.drawLegend()
      this.$emit('onload')
    },
    createCanvas() {
      this.canvas = document.createElement('canvas')
      this.canvas.className = 'main_canvas'
      this.setCanvasStyle()
      this.$refs.heatmap.appendChild(this.canvas)
      this.canvasCtx = this.canvas.getContext('2d')
    },
    // 创建用于保存已有图像的图层 (隐藏)
    createFallsCanvas() {
      this.fallsCanvas = document.createElement('canvas')
      this.fallsCanvas.width = this.canvasWidth
      this.fallsCanvas.height = this.height
      this.fallsCanvasCtx = this.fallsCanvas.getContext('2d')
    },
    // 创建图例 图层
    createLegendCanvas() {
      const legendCanvas = document.createElement('canvas')
      legendCanvas.width = 1
      this.legendCanvasCtx = legendCanvas.getContext('2d')
    },
    // 创建框选图层 用于框选交互
    createRangeCanvas() {
      this.rangeCanvas = document.createElement('canvas')
      this.rangeCanvas.width = this.canvas.width - this.legendWidth
      this.rangeCanvas.height = this.canvas.height
      this.rangeCanvas.className = 'select_canvas'
      this.rangeCanvas.style.cssText = `left: ${this.legendWidth}px`
      this.rangeCanvasCtx = this.rangeCanvas.getContext('2d')
      this.$refs.heatmap.appendChild(this.rangeCanvas)
      if (!this.selection) return
      this.rangeCanvas.addEventListener('mousedown', this.rangeCanvasMousedown)
      this.rangeCanvas.addEventListener('mousemove', this.rangeCanvasMousemove)
      this.rangeCanvas.addEventListener('mouseup', this.rangeCanvasMouseup)
      this.rangeCanvas.addEventListener('mouseout', this.rangeCanvasMouseup)
    },
    rangeCanvasMousedown(e) {
      this.clearRangeCanvasRect()
      this.$emit('cancel-select')
      this.beginX = e.offsetX
      this.beginY = e.offsetY
      this.isDraw = true
    },
    clearRangeCanvasRect() {
      this.rangeCanvasCtx.clearRect(
        0,
        0,
        this.rangeCanvas.width,
        this.rangeCanvas.height
      )
    },
    rangeCanvasMousemove(e) {
      if (!this.isDraw) return
      this.endX = e.offsetX
      this.endY = e.offsetY
      this.rectFn(this.rangeCanvasCtx, this.endX, this.endY)
    },
    rangeCanvasMouseup(e) {
      if (!this.isFirstRender && this.endX !== 0) {
        const min = this.startFrequency + this.beginX * this.chartScale
        const max = this.startFrequency + this.endX * this.chartScale
        const centerFrequency = ((max + min) / 2 / 1e6).toFixed(6)
        const bandWidth = (Math.abs(max - min) / 1e3).toFixed(6)
        const text1 = `中心频率：${centerFrequency}MHz`
        const text2 = `带宽：${bandWidth}KHz`
        this.rangeCanvasCtx.fillStyle = '#fff'
        this.rangeCanvasCtx.textAlign = 'center'
        this.rangeCanvasCtx.font = 'bold 14px Arial, Helvetica, sans-serif'
        this.rangeCanvasCtx.fillText(
          text1,
          (this.beginX + this.endX) / 2,
          this.beginY + 12
        )
        this.rangeCanvasCtx.fillText(
          text2,
          (this.beginX + this.endX) / 2,
          this.beginY + 28
        )

        let startIndex, endIndex
        if (this.dataList[this.beginY] && this.dataList[this.endY]) {
          if (this.beginY > this.endY) {
            startIndex = this.dataList[this.beginY]
            endIndex = this.dataList[this.endY]
          } else if (this.beginY < this.endY) {
            startIndex = this.dataList[this.endY]
            endIndex = this.dataList[this.beginY]
          }
          let duration =
            (endIndex - startIndex) / this.fileData?.value?.sampleRate
          const text3 = `时长：${duration.toFixed(6)}s`
          this.rangeCanvasCtx.fillText(
            text3,
            (this.beginX + this.endX) / 2,
            this.beginY + 45
          )
        }
        this.endX = 0
        this.$emit('drawRect', {
          min,
          max,
          startIndex,
          endIndex,
          center: (max + min) / 2,
          type: 'FALLS',
        })
      }
      this.isDraw = false
    },
    rectFn(ctx, x, y) {
      const beginX = this.beginX
      const beginY = this.beginY
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.width)
      ctx.fillStyle = 'rgba(153, 153, 153, .6)'
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 1
      ctx.fillRect(beginX, beginY, x - beginX, y - beginY)
      ctx.strokeRect(beginX, beginY, x - beginX, y - beginY)
      ctx.beginPath()
      ctx.moveTo(beginX + (x - beginX) / 2, beginY)
      ctx.lineTo(beginX + (x - beginX) / 2, y)
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.closePath()
    },
    initColormap() {
      this.colormap = colormap({
        colormap: this.colormapName,
        nshades: 150,
        format: 'rba',
        alpha: 1,
      })
      console.log(this.colormap);
    },
    // 重新计算 canvas 宽度,使得页面在缩放实时重制
    setCanvasStyle(height = null) {
      if (this.$refs.heatmap && this.canvas) {
        const viewWidth = this.$refs.heatmap.clientWidth
        const viewHeight = this.$refs.heatmap.clientHeight
        this.canvas.height = height || viewHeight - this.padding
        this.canvas.width = viewWidth
      }
    },
    // * 输入数据,触发绘制
    addData(res) {
      this.setCanvasStyle()
      if (this.isFirstRender) {
        const { startFrequency, stopFrequency } = res
        Object.assign(this, {
          startFrequency,
          stopFrequency,
        })
        const dataLength = stopFrequency - startFrequency
        this.chartScale = dataLength / this.rangeCanvas.width
        this.isFirstRender = false
      }
      // 等于 undefined 的时候让它执行下面，切换频谱图显示的时候会有undefined
      if (this.fallsCanvasCtx.canvas === undefined) return
      if (res.data.length !== this.canvasWidth) {
        this.canvasWidth = res.data.length
        this.fallsCanvas.width = this.canvasWidth
      }
      //临时设置的阈值 需要考虑瀑布图的高度
      if (this.dataList.length > 800) {
        this.dataList = this.dataList.slice(0, 800)
      }
      this.dataList.unshift(res.SampleIndex)
      this.addWaterfallRow(res.data)
      this.drawImage()
      this.drawLegend()
    },
    // 绘制瀑布图,隐藏状态
    addWaterfallRow(data) {
      // 将已生成的图像向下移动一个像素
      this.fallsCanvasCtx.drawImage(
        this.fallsCanvasCtx.canvas,
        0,
        0,
        this.canvasWidth,
        this.height,
        0,
        1,
        this.canvasWidth,
        this.height
      )
      // 通过数据绘制第一行图像,并插入在第一行像素中
      const imageData = this.rowToImageData(data)
      this.fallsCanvasCtx.putImageData(imageData, 0, 0)
    },
    // 绘制单行图像
    rowToImageData(data) {
      console.log(data.length);
      const imageData = this.fallsCanvasCtx.createImageData(data.length, 1)
      console.log(imageData.data);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const cIndex = this.squeeze(data[i / 4], 0, 135)
        const color = this.colormap[cIndex]
        imageData.data[i + 0] = color[0]
        imageData.data[i + 1] = color[1]
        imageData.data[i + 2] = color[2]
        imageData.data[i + 3] = 255
      }
      return imageData
    },
    // 返回数据对应的 colormap
    squeeze(data, outMin, outMax) {
      if (data <= this.minDb) {
        return outMin
      } else if (data >= this.maxDb) {
        return outMax
      } else {
        return round(((data - this.minDb) / (this.maxDb - this.minDb)) * outMax)
      }
    },
    // 绘制到 canvas 中
    drawImage() {
      const width = this.canvasCtx.canvas.width
      const height = this.canvasCtx.canvas.height
      if (!this.fallsCanvasCtx.canvas.width) return
      this.canvasCtx.drawImage(
        this.fallsCanvasCtx.canvas,
        0,
        0,
        this.canvasWidth,
        this.height,
        this.legendWidth,
        0,
        width - this.legendWidth,
        height
      )
    },
    // 绘制图例
    drawLegend() {
      const imageData = this.legendCanvasCtx.createImageData(
        1,
        this.colormap.length
      )
      for (let i = 0; i < this.colormap.length; i++) {
        const color = this.colormap[i]
        imageData.data[imageData.data.length - i * 4 + 0] = color[0]
        imageData.data[imageData.data.length - i * 4 + 1] = color[1]
        imageData.data[imageData.data.length - i * 4 + 2] = color[2]
        imageData.data[imageData.data.length - i * 4 + 3] = 255
      }
      this.legendCanvasCtx.putImageData(imageData, 0, 0)
      this.canvasCtx.drawImage(
        this.legendCanvasCtx.canvas,
        0,
        0,
        1,
        this.colormap.length,
        (this.legendWidth * 3) / 4 - 5,
        0,
        this.legendWidth / 4,
        this.canvasCtx.canvas.height
      )
      this.canvasCtx.font = '12px Arial'
      this.canvasCtx.textAlign = 'end'
      this.canvasCtx.fillStyle = '#fff'
      this.canvasCtx.fillText(this.maxDb, (this.legendWidth * 3) / 4 - 10, 12)
      this.canvasCtx.fillText(
        this.minDb,
        (this.legendWidth * 3) / 4 - 10,
        this.height - 6
      )
    },
    clear() {
      this.fallsCanvasCtx.clearRect(
        0,
        0,
        this.fallsCanvas.width,
        this.fallsCanvas.height
      )
      this.canvasCtx.clearRect(
        this.legendWidth,
        0,
        this.rangeCanvas.width,
        this.rangeCanvas.height
      )
      this.rangeCanvasCtx.clearRect(
        0,
        0,
        this.rangeCanvas.width,
        this.rangeCanvas.height
      )
      this.isFirstRender = true
    },
    setAnalyzeParams(params) {
      Object.assign(this, {
        aggregationFrame: params.aggregation_frame,
        fftSize: params.fft_size - 0,
      })
    },
  },
}
</script>

<style lang="scss" scoped>
.heatmap {
  min-width: 200px;
  background-color: rgba(#000, 0);
  position: relative;
  overflow: hidden;

  span {
    position: absolute;
    left: -14px;
    top: 50%;
    font-size: 12px;
    transform: translateY(-100%) rotate(-90deg);
  }

  ::v-deep .main_canvas {
    position: relative;
  }
  ::v-deep .select_canvas {
    position: absolute;
    top: 0;
    left: 0;
  }
}
</style>
