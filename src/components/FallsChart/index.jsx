import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { round } from 'lodash'
import style from './index.module.styl'
const ColorMap = require('colormap')

const FallsChart = React.forwardRef(({
  title = '瀑布图(dBuv)',
  height = 50,
  minDb = -125,
  maxDb = 0,
  legendWidth = 64,
  padding = 2,
  colormapName = 'jet',
  selection = true,
}, ref) => {
  const heatmap = useRef(null)
  let canvas = null // 实际用于渲染瀑布图的 canvas DOM
  let canvasCtx = null // 实际用于渲染瀑布图的 canvas context
  let rangeCanvas = null // 用于实现框选效果的 canvas DOM引用
  let rangeCanvasCtx = null // 用于实现框选效果的 canvas context
  let fallsCanvas = null // 用于保存已生成的瀑布图 canvas 引用
  let fallsCanvasCtx = null // 用于保存已生成的瀑布图 canvas context
  let legendCanvasCtx = null // 图例 canvas context
  let canvasWidth = 0
  let colormap = []
  let isFirstRender = true
  let beginX = 0
  let beginY = 0
  let endX = 0
  let endY = 0
  let isDraw = false
  let chartScale = 0
  let startFrequency = 0
  let stopFrequency = 0
  let aggregationFrame = 1 // 聚合帧数
  let fftSize = 2048 // 傅里叶参数
  let dataList = [] // 已播放的瀑布图每一帧的数据(当前播放下标)

  const createCanvas = () => {
    canvas = document.createElement('canvas')
    canvas.className = 'main_canvas'
    setCanvasStyle()
    heatmap.current.appendChild(canvas)
    canvasCtx = canvas.getContext('2d')
  }
  const createFallsCanvas = () => {
    fallsCanvas = document.createElement('canvas')
    fallsCanvas.width = canvasWidth
    fallsCanvas.height = height
    fallsCanvasCtx = fallsCanvas.getContext('2d')
  }
  // 创建图例 图层
  const createLegendCanvas = () => {
    const legendCanvas = document.createElement('canvas')
    legendCanvas.width = 1
    legendCanvasCtx = legendCanvas.getContext('2d')
  }

  const initColormap = () => {
    colormap = ColorMap({
      colormap: colormapName,
      nshades: 150,
      format: 'rba',
      alpha: 1,
    })
  }
  // 重新计算 canvas 宽度,使得页面在缩放实时重制
  const setCanvasStyle = (height = null) => {
    if (heatmap.current && canvas) {
      const viewWidth = heatmap.current.clientWidth
      const viewHeight = heatmap.current.clientHeight
      canvas.height = height || viewHeight - padding
      canvas.width = viewWidth
    }
  }
  // * 输入数据,触发绘制
  const addData = res => {
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
  }
  // 绘制瀑布图,隐藏状态
  const addWaterfallRow = data => {
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
  }
  // 绘制单行图像
  const rowToImageData = data => {
    console.log(data.length)
    const imageData = this.fallsCanvasCtx.createImageData(data.length, 1)
    console.log(imageData.data)
    for (let i = 0; i < imageData.data.length; i += 4) {
      const cIndex = this.squeeze(data[i / 4], 0, 135)
      const color = this.colormap[cIndex]
      imageData.data[i + 0] = color[0]
      imageData.data[i + 1] = color[1]
      imageData.data[i + 2] = color[2]
      imageData.data[i + 3] = 255
    }
    return imageData
  }
  // 返回数据对应的 colormap
  const squeeze = (data, outMin, outMax) => {
    if (data <= this.minDb) {
      return outMin
    } else if (data >= this.maxDb) {
      return outMax
    } else {
      return round(((data - this.minDb) / (this.maxDb - this.minDb)) * outMax)
    }
  }
  // 绘制到 canvas 中
  const drawImage = () => {
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
  }
  // 绘制图例
  const drawLegend = () => {
    const imageData = legendCanvasCtx.createImageData(1, colormap.length)
    for (let i = 0; i < colormap.length; i++) {
      const color = colormap[i]
      imageData.data[imageData.data.length - i * 4 + 0] = color[0]
      imageData.data[imageData.data.length - i * 4 + 1] = color[1]
      imageData.data[imageData.data.length - i * 4 + 2] = color[2]
      imageData.data[imageData.data.length - i * 4 + 3] = 255
    }
    legendCanvasCtx.putImageData(imageData, 0, 0)
    canvasCtx.drawImage(
      legendCanvasCtx.canvas,
      0,
      0,
      1,
      colormap.length,
      (legendWidth * 3) / 4 - 5,
      0,
      legendWidth / 4,
      canvasCtx.canvas.height
    )
    canvasCtx.font = '12px Arial'
    canvasCtx.textAlign = 'end'
    canvasCtx.fillStyle = '#fff'
    canvasCtx.fillText(maxDb, (legendWidth * 3) / 4 - 10, 12)
    canvasCtx.fillText(minDb, (legendWidth * 3) / 4 - 10, height - 6)
  }
  const clear = () => {
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
  }
  const setAnalyzeParams = params => {
    Object.assign(this, {
      aggregationFrame: params.aggregation_frame,
      fftSize: params.fft_size - 0,
    })
  }

  const initComponent = () => {
    initColormap()
    createCanvas()
    createFallsCanvas()
    createLegendCanvas()
    drawLegend()
  }

  useEffect(() => {
    if (heatmap.current.clientWidth <= 0) {
      nextTick(() => {
        initComponent()
      })
      return
    }
    initComponent()
  }, [])


  useImperativeHandle(ref, () => ({
    addData: addData
  }))

  return (
    <div className={style.heatmap} style={{ height }} ref={heatmap}>
      <span>{title}</span>
    </div>
  )
})

export default FallsChart
