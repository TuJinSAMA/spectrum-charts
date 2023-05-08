import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { round } from 'lodash'
import style from './index.module.styl'
const ColorMap = require('colormap')

const FallsChart = React.forwardRef(
  (
    {
      title = '瀑布图(dBuv)',
      height = 50,
      minDb = -125,
      maxDb = 0,
      legendWidth = 64,
      padding = 2,
      colormapName = 'jet',
      selection = true,
    },
    ref
  ) => {
    const heatmap = useRef(null)

    const [state, setState] = useState({
      canvasCtx: null, 
      fallsCanvas: null,
      fallsCanvasCtx: null,
      legendCanvasCtx: null,
      canvasWidth: 0,
      colormap: [],
    })

    useEffect(() => {
      initComponent()
    }, [])

    // 初始化组件
    const initComponent = () => {
      if (!heatmap.current) return
      // 获取容器的宽高
      const width = heatmap.current.clientWidth
      const height = heatmap.current.clientHeight
      // 初始化颜色图
      const colormap = initColormap()
      // 创建画布
      const { fallsCanvasCtx, canvasCtx, legendCanvasCtx } = createCanvas(
        width,
        height
      )
      // 绘制左边颜色图图例
      drawLegend(canvasCtx, legendCanvasCtx, colormap)
      // 更新 state
      setState(s => ({
        ...s,
        colormap,
        fallsCanvasCtx,
        canvasCtx,
        legendCanvasCtx,
      }))
    }

    // 初始化颜色图
    const initColormap = () => {
      return ColorMap({
        colormap: colormapName,
        nshades: 150,
        format: 'rba',
        alpha: 1,
      })
    }

    // 创建画布
    // 这里需要创建三个画布，一个用来绘制瀑布图，另一个将绘制好的瀑布图展示在页面上,最后一个是左侧颜色图图例的画布
    const createCanvas = (width, height) => {
      // 创建用来绘制的画布
      const fallsCanvas = document.createElement('canvas')
      fallsCanvas.width = 0
      fallsCanvas.height = height
      const fallsCanvasCtx = fallsCanvas.getContext('2d')

      // 创建最终展示的画布
      const canvas = document.createElement('canvas')
      canvas.className = 'main_canvas'
      canvas.height = height - padding
      canvas.width = width
      heatmap.current.appendChild(canvas)
      const canvasCtx = canvas.getContext('2d')

      // 创建图例图层画布
      const legendCanvas = document.createElement('canvas')
      legendCanvas.width = 1
      const legendCanvasCtx = legendCanvas.getContext('2d')
      return {
        fallsCanvasCtx,
        canvasCtx,
        legendCanvasCtx,
      }
    }

    // 更新瀑布图 传入要渲染的数据
    const updateChart = result => {
      const len = result.data.length
      if (len !== state.canvasWidth) {
        setState(s => ({
          ...s,
          canvasWidth: len,
        }))
        state.fallsCanvasCtx.canvas.width = len
      }
      // 先在用于绘制的画布上绘制图像
      addWaterfallRow(result.data)
      // 再将画好的图像显示在页面中
      drawFallsOnCanvas(len)
      // 最后再绘制一遍图例 (不然会被覆盖)
      // drawLegend(state.canvasCtx, state.legendCanvasCtx, state.colormap)
    }
    // 绘制瀑布图,隐藏状态
    const addWaterfallRow = data => {
      // 先将已生成的图像向下移动一个像素
      state.fallsCanvasCtx.drawImage(
        state.fallsCanvasCtx.canvas,
        0,
        0,
        data.length,
        height,
        0,
        1,
        data.length,
        height
      )
      // 再画新一行的数据
      const imageData = rowToImageData(data)
      state.fallsCanvasCtx.putImageData(imageData, 0, 0)
    }
    // 绘制单行图像
    const rowToImageData = data => {
      const imageData = state.fallsCanvasCtx.createImageData(data.length, 1)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const cIndex = getCurrentColorIndex(data[i / 4])
        const color = state.colormap[cIndex]
        imageData.data[i + 0] = color[0]
        imageData.data[i + 1] = color[1]
        imageData.data[i + 2] = color[2]
        imageData.data[i + 3] = 255
      }
      return imageData
    }
    // 获取数据对应的颜色图索引
    const getCurrentColorIndex = data => {
      const outMin = 0
      const outMax = state.colormap.length - 1
      if (data <= minDb) {
        return outMin
      } else if (data >= maxDb) {
        return outMax
      } else {
        return round(((data - minDb) / (maxDb - minDb)) * outMax)
      }
    }
    // 将绘制好的图像显示在页面中
    const drawFallsOnCanvas = len => {
      const canvasWidth = state.canvasCtx.canvas.width
      const canvasHeight = state.canvasCtx.canvas.height
      if (!state.fallsCanvasCtx.canvas.width) return
      state.canvasCtx.drawImage(
        state.fallsCanvasCtx.canvas,
        0,
        0,
        len,
        height,
        legendWidth,
        0,
        canvasWidth - legendWidth,
        canvasHeight
      )
    }
    // 绘制图例
    const drawLegend = (canvasCtx, legendCanvasCtx, colormap) => {
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
    const resetChart = () => {
      state.fallsCanvasCtx.clearRect(
        0,
        0,
        state.fallsCanvasCtx.canvas.width,
        state.fallsCanvasCtx.canvas.height
      )
      state.canvasCtx.clearRect(
        legendWidth,
        0,
        state.fallsCanvasCtx.canvas.width,
        state.fallsCanvasCtx.canvas.height
      )

    }

    useImperativeHandle(ref, () => ({
      updateChart: updateChart,
    }))

    return (
      <div className={style.heatmap} style={{ height }} ref={heatmap}>
        <span>{title}</span>
      </div>
    )
  }
)

export default FallsChart
