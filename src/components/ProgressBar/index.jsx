import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { round, throttle } from 'lodash'
// import { getMockProgress } from '@/api/mock-api'
// import useAppStore from '@/store/modules/app'
import style from './index.module.styl'

const ColorMap = require('colormap')

const ProgressBar = React.forwardRef(
  ({ maxDb = 0, minDb = -140, percentage = 0 }, ref) => {
    const progressBox = useRef(null)

    let [state, setState] = useState({
      boxWidth: 0,
      boxHeight: 0,
      canvasCtx: null,
      fallsCanvasCtx: null,
      colors: null,
    })

    useEffect(() => {
      initComponent()
    }, [])

    // 初始化组件
    const initComponent = () => {
      // 先获取进度条容器的宽度和高度
      const boxWidth = progressBox.current.clientWidth
      const boxHeight = progressBox.current.clientHeight
      // 创建进度条画布
      const [canvasCtx, fallsCanvasCtx] = createCanvas(boxWidth, boxHeight)
      // 初始化颜色图
      const colors = initColors()
      // 更新到 state 中
      setState(s => ({
        ...s,
        boxWidth,
        boxHeight,
        canvasCtx,
        fallsCanvasCtx,
        colors,
      }))
    }

    // 创建画布
    // 这里需要创建两个画布，一个用来绘制瀑布图，另一个将绘制好的瀑布图展示在页面上
    const createCanvas = (width, height) => {
      // 创建用来绘制的画布
      const fallsCanvas = document.createElement('canvas')
      fallsCanvas.width = width
      fallsCanvas.height = height
      const fallsCanvasCtx = fallsCanvas.getContext('2d')

      // 创建最终展示的画布
      const canvas = document.createElement('canvas')
      canvas.className = 'progress_canvas'
      canvas.width = width
      canvas.height = height
      // 将最终展示的画布添加到容器里
      progressBox.current.appendChild(canvas)
      const canvasCtx = canvas.getContext('2d')
      return [canvasCtx, fallsCanvasCtx]
    }

    // 初始化颜色图
    const initColors = () => {
      if (maxDb === undefined || minDb === undefined) return
      const len = maxDb - minDb
      return ColorMap({
        colormap: 'jet',
        nshades: len,
        format: 'rba',
        alpha: 1,
      })
    }

    // 绘制进度条
    // 会将该方法暴露给父组件 父组件调用时传入进度条数据
    const drawProgress = data => {
      // 根据容器的宽高聚合数据
      let len = data.length
      const scale = len / state.boxWidth
      // 最终拿来渲染的数据
      let arr = []
      for (let i = len; i > 0; i -= scale) {
        // 从数组尾部开始遍历 确保数据正确性
        const startIndex = round(i - scale)
        const endIndex = round(i)
        let col = data.slice(startIndex, endIndex)
        if (col.length > 1) {
          let newCol = []
          let cols = col.map(item => disposeColData(item))
          cols[0].forEach((p, i) => {
            let result = 0
            for (let c = 0; c < cols.length; c++) {
              result += cols[c][i]
            }
            // 取平均值
            newCol.push(result / cols.length)
          })
          // 用聚合过后的数据绘制单列图像
          drawColImgData(newCol)
          arr.push(newCol)
        } else {
          // 用聚合过后的数据绘制单列图像
          arr.push(drawColImgData(disposeColData(col[0])))
        }
        if (round(i - scale) === 0) break
      }
      state.canvasCtx.drawImage(
        state.fallsCanvasCtx.canvas,
        0,
        0,
        state.boxWidth,
        state.boxHeight
        // 0,
        // 0,
        // state.boxWidth,
        // state.boxHeight
      )
      // 绘制进度条的指示线
      drawLineBox()
    }

    const drawColImgData = data => {
      // 创建一个 宽度为1px 高度与容器高度相同的 imageData
      const imageData = state.fallsCanvasCtx.createImageData(1, state.boxHeight)
      // imageData 是一个长度为 width * height * 4 的 Uint8ClampedArray()
      // 所以遍历时以4个索引为步长
      for (let i = 0; i < imageData.data.length; i += 4) {
        // 获取当前数据对应的 颜色图索引
        const cIndex = getCurrentColorIndex(data[i / 4])
        // 取出对应颜色的 RGB 值
        const color = state.colors[cIndex]
        // 赋值
        imageData.data[i + 0] = color[0]
        imageData.data[i + 1] = color[1]
        imageData.data[i + 2] = color[2]
        imageData.data[i + 3] = 255
      }
      // 在画布的左上角绘制
      state.fallsCanvasCtx.putImageData(imageData, 0, 0)
      // 我们每次都在左上角画一列的图像
      // 所以将已生成的图像向右移动一个像素
      state.fallsCanvasCtx.drawImage(
        state.fallsCanvasCtx.canvas,
        // 0,
        // 0,
        // state.boxWidth,
        // state.boxHeight,
        1,
        0,
        state.boxWidth,
        state.boxHeight
      )
      return data
    }

    // 处理单列图像的数据聚合
    const disposeColData = data => {
      let len = data.length
      const scale = len / state.boxHeight
      let result = []
      for (let i = 0; i <= len; i += scale) {
        const startIndex = round(i)
        const endIndex = round(i + scale)
        let points = data.slice(startIndex, endIndex)
        // 取平均值
        let point =
          points.reduce((res, item) => (res += item), 0) / points.length
        result.push(point)
      }
      return result
    }

    // 返回数据对应的 颜色图 color 集合索引
    const getCurrentColorIndex = value => {
      const min = 0
      const max = state.colors.length - 1
      if (value <= minDb) {
        return min
      } else if (value >= maxDb) {
        return max
      } else {
        return round(((value - minDb) / (maxDb - minDb)) * max)
      }
    }

    let [lineBox, setLineBox] = useState(null)
    useEffect(() => {
      if (!lineBox) return
      progressBox.current.appendChild(lineBox)
      progressBox.current.addEventListener('mousedown', handlerMouseDown)
      progressBox.current.addEventListener('mousemove', throttleMouseMove)
      progressBox.current.addEventListener('mouseup', handlerMouseUp)
      progressBox.current.addEventListener('mouseleave', handlerMouseUp)
    }, [lineBox])

    let isMove = false
    const drawLineBox = () => {
      const lineBox = document.createElement('div')
      lineBox.className = 'line_box'
      lineBox.style.height = state.boxHeight + 'px'
      setLineBox(lineBox)
    }


    const handlerMouseDown = e => {
      if (e.target.className === 'line_box') isMove = true
    }

    const handlerMouseMove = e => {
      if (!isMove) return
      if (e.target.className === 'line_box') {
        const offsetLeft = lineBox.offsetLeft
        if (
          offsetLeft <= 0 ||
          offsetLeft + lineBox.clientWidth >= state.boxWidth
        )
          return
        lineBox.style.left = e.offsetX + offsetLeft + 'px'
      } else {
        lineBox.style.left = e.offsetX + 'px'
      }
      if (
        lineBox.offsetLeft <= 0 ||
        lineBox.offsetLeft + lineBox.clientWidth >= state.boxWidth
      ) {
        isMove = false
      }
    }

    const throttleMouseMove = throttle(handlerMouseMove, 4)

    const handlerMouseUp = e => {
      if (!isMove) return
      isMove = false
      const percent = (lineBox.offsetLeft / state.boxWidth) * 100
      console.log(`改变进度到: ${percent}%`)
    }

    useEffect(() => {
      console.log('percentage changed!', percentage)
      if (isMove) return
      if (lineBox) {
        lineBox.style.left = `${percentage}%`
      }
    }, [percentage])

    const resetProgressBar = () => {
      state.canvasCtx.clearRect(0, 0, state.boxWidth, state.boxHeight)
      state.fallsCanvasCtx.clearRect(0, 0, state.boxWidth, state.boxHeight)
      lineBox && lineBox.remove()
    }

    useImperativeHandle(ref, () => ({
      drawProgress: drawProgress,
    }))

    return <div className={style.progress_box} ref={progressBox}></div>
  }
)

export default ProgressBar
