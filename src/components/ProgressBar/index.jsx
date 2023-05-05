import React, { useState, useEffect, useRef, useImperativeHandle } from 'react'
import { round, throttle } from 'lodash'
// import { getMockProgress } from '@/api/mock-api'
// import useAppStore from '@/store/modules/app'
import style from './index.module.styl'

const ColorMap = require('colormap')

const ProgressBar = React.forwardRef(
  ({ maxDb = 0, minDb = -140, percentage = 0 }, ref) => {
    const progressBox = useRef(null)
    // let boxWidth = 0
    // let boxHeight = 0
    // let canvasCtx = null
    // let fallsCanvasCtx = null
    // let colors = null
    let [state, setState] = useState({
      baseData: [],
      boxWidth: 0,
      boxHeight: 0,
      canvasCtx: null,
      fallsCanvasCtx: null,
      colors: null,
    })

    useEffect(() => {
      if (progressBox.current.clientWidth !== 0) {
        initComponent()
      } else {
        nextTick(() => {
          initComponent()
        })
      }
    }, [])

    const initComponent = () => {
      // boxWidth = progressBox.current.clientWidth
      // boxHeight = progressBox.current.clientHeight
      setState({
        ...state,
        boxWidth: progressBox.current.clientWidth,
        boxHeight: progressBox.current.clientHeight,
      })
      createCanvas()
      createFallsCanvas()
      initColors()
    }

    const createCanvas = () => {
      const canvas = document.createElement('canvas')
      canvas.className = 'progress_canvas'
      canvas.width = state.boxWidth
      canvas.height = state.boxHeight
      progressBox.current.appendChild(canvas)
      setState({
        ...state,
        canvasCtx: canvas.getContext('2d'),
      })
      console.log(state);
    }
    const createFallsCanvas = () => {
      const canvas = document.createElement('canvas')
      canvas.width = state.boxWidth
      canvas.height = state.boxHeight
      setState({
        ...state,
        fallsCanvasCtx: canvas.getContext('2d'),
      })
    }

    const initColors = () => {
      if (maxDb === undefined || minDb === undefined) return
      const len = maxDb - minDb
      let colors = ColorMap({
        colormap: 'jet',
        nshades: len,
        format: 'rba',
        alpha: 1,
      })
      setState({
        ...state,
        colors,
      })
    }

    const drawProgress = data => {
      setState({
        ...state,
        baseData: data,
      })
      let len = data.length
      console.log(state.boxWidth)
      const scale = len / state.boxWidth
      let arr = []
      for (let i = len; i > 0; i -= scale) {
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
            newCol.push(result / cols.length)
          })
          console.log(state)
          drawColImgData(newCol)
          arr.push(newCol)
        } else {
          arr.push(drawColImgData(disposeColData(col[0])))
        }
        if (round(i - scale) === 0) break
      }
      canvasCtx.value.drawImage(
        fallsCanvasCtx.value.canvas,
        0,
        0,
        boxWidth.value,
        boxHeight.value,
        0,
        0,
        boxWidth.value,
        boxHeight.value
      )
      drawLineBox()
      drawSelectionBox()
    }

    const lineBox = null
    const isMove = false
    const drawLineBox = () => {
      lineBox.value = document.createElement('div')
      lineBox.value.className = 'line_box'
      lineBox.value.style.height = boxHeight.value + 'px'
      progressBox.current.appendChild(lineBox.value)
      progressBox.current.addEventListener('mousedown', handlerMouseDown)
      progressBox.current.addEventListener('mousemove', throttleMouseMove)
      progressBox.current.addEventListener('mouseup', handlerMouseUp)
      progressBox.current.addEventListener('mouseleave', handlerMouseUp)
    }

    const selectionBox = null
    const drawSelectionBox = () => {
      selectionBox.value = document.createElement('div')
      selectionBox.value.className = 'selection_box'
      selectionBox.value.style.height = boxHeight.value + 'px'
      progressBox.current.appendChild(selectionBox.value)
    }

    const isSelection = false
    const operateType = 'SELECTION'
    const beginX = 0
    const endX = 0
    const isClick = true
    const handlerMouseDown = e => {
      if (e.target.className === 'line_box') {
        isMove.value = true
        operateType.value = 'DRAG'
      } else {
        isClick.value = true
        selectionBox.value.style.width = 0
        selectionBox.value.style.opacity = 0
        emit('cancel-select')
        isSelection.value = true
        beginX.value =
          e.target.className === 'selection_box'
            ? selectionBox.value.offsetLeft + e.offsetX
            : e.offsetX
        operateType.value = 'SELECTION'
      }
    }

    const handlerMouseMove = e => {
      switch (operateType.value) {
        case 'SELECTION':
          handlerMoveSelection(e)
          break
        case 'DRAG':
          handlerMoveDrag(e)
          break
        default:
          break
      }
    }

    const handlerMoveDrag = e => {
      if (!isMove.value) return
      // e.stopPropagation()
      if (e.target.className === 'line_box') {
        const offsetLeft = lineBox.value.offsetLeft
        if (
          offsetLeft <= 0 ||
          offsetLeft + lineBox.value.clientWidth >= boxWidth.value
        )
          return
        lineBox.value.style.left = e.offsetX + offsetLeft + 'px'
      } else if (e.target.className === 'selection_box') {
        lineBox.value.style.left =
          selectionBox.value.offsetLeft + e.offsetX + 'px'
      } else {
        lineBox.value.style.left = e.offsetX + 'px'
      }
      if (
        lineBox.value.offsetLeft <= 0 ||
        lineBox.value.offsetLeft + lineBox.value.clientWidth >= boxWidth.value
      ) {
        isMove.value = false
      }
    }

    const handlerMoveSelection = e => {
      if (!isSelection.value) return
      isClick.value = false
      selectionBox.value.style.opacity = 1
      endX.value =
        e.target.className === 'selection_box'
          ? selectionBox.value.offsetLeft + e.offsetX
          : e.target.className === 'line_box'
          ? lineBox.value.offsetLeft + e.offsetX
          : e.offsetX
      if (endX.value > beginX.value) {
        selectionBox.value.style.left = `${beginX.value}px`
        selectionBox.value.style.width = `${endX.value - beginX.value}px`
      } else if (endX.value < beginX.value) {
        selectionBox.value.style.left = `${endX.value}px`
        selectionBox.value.style.width = `${Math.abs(
          endX.value - beginX.value
        )}px`
      }
    }

    const throttleMouseMove = throttle(handlerMouseMove, 4)

    const handlerMouseUp = e => {
      switch (operateType.value) {
        case 'SELECTION':
          handlerSelectionUp(e)
          break
        case 'DRAG':
          handlerDragUp(e)
          break
        default:
          break
      }
    }

    const handlerDragUp = e => {
      if (!isMove.value) return
      isMove.value = false
      const percent = (lineBox.value.offsetLeft / boxWidth.value) * 100
      emit('progress-change', percent)
    }

    const handlerSelectionUp = e => {
      if (!isSelection.value) return
      isSelection.value = false
      if (totalCount.value === 0 || isClick.value) return
      let start, end
      if (beginX.value > endX.value) {
        start = Math.round((endX.value / boxWidth.value) * totalCount.value)
        end = Math.round((beginX.value / boxWidth.value) * totalCount.value)
      } else {
        start = Math.round((beginX.value / boxWidth.value) * totalCount.value)
        end = Math.round((endX.value / boxWidth.value) * totalCount.value)
      }
      emit('progress-selected', {
        start,
        end,
      })
    }

    const percentStorage = 0
    // watch(props.percentage, newValue => {
    //   if (isMove.value) return
    //   percentStorage.value = newValue
    //   if (lineBox.value) {
    //     lineBox.value.style.left = `${newValue}%`
    //   }
    // })

    useEffect(() => {
      console.log('percentage changed!', percentage)
    }, [percentage])

    const totalCount = 0

    const setLineBoxStyle = data => {
      const percent =
        (data.aggregation_frame * (data.fft_size - 0)) / totalCount.value
      const lineWidth = percent * boxWidth.value
      if (lineBox.value) {
        lineBox.value.style.width = lineWidth + 'px'
      }
    }

    const drawColImgData = data => {
      const imageData = state.fallsCanvasCtx.createImageData(1, boxHeight.value)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const cIndex = getCurrentColor(data[i / 4])
        const color = state.colors[cIndex]
        imageData.data[i + 0] = color[0]
        imageData.data[i + 1] = color[1]
        imageData.data[i + 2] = color[2]
        imageData.data[i + 3] = 255
      }
      state.fallsCanvasCtx.putImageData(imageData, 0, 0)
      // 将已生成的图像向右移动一个像素
      state.fallsCanvasCtx.drawImage(
        state.fallsCanvasCtx.value.canvas,
        0,
        0,
        boxWidth.value,
        boxHeight.value,
        1,
        0,
        boxWidth.value,
        boxHeight.value
      )
      return data
    }

    const disposeColData = data => {
      let len = data.length
      const scale = len / state.boxHeight
      let result = []
      for (let i = 0; i <= len; i += scale) {
        const startIndex = round(i)
        const endIndex = round(i + scale)
        let points = data.slice(startIndex, endIndex)
        let point =
          points.reduce((res, item) => (res += item), 0) / points.length
        result.push(point)
      }
      return result
    }

    // 返回数据对应的 color 集合
    const getCurrentColor = value => {
      const min = 0
      const max = colors.value.length - 1
      if (value <= props.minDb) {
        return min
      } else if (value >= props.maxDb) {
        return max
      } else {
        return round(
          ((value - props.minDb) / (props.maxDb - props.minDb)) * max
        )
      }
    }

    const resetProgress = () => {
      canvasCtx.value.clearRect(0, 0, boxWidth.value, boxHeight.value)
      fallsCanvasCtx.value.clearRect(0, 0, boxWidth.value, boxHeight.value)
      lineBox.value && lineBox.value.remove()
      baseData.value = []
    }

    const setTotalCount = count => {
      if (count === totalCount.value) return
      totalCount.value = count
    }

    const setProgressWidth = () => {
      boxWidth.value = progressBox.current.clientWidth
      boxHeight.value = progressBox.current.clientHeight
      canvasCtx.value.canvas.width = boxWidth.value
      canvasCtx.value.canvas.height = boxHeight.value
      fallsCanvasCtx.value.canvas.width = boxWidth.value
      fallsCanvasCtx.value.canvas.height = boxHeight.value
      if (lineBox.value) {
        lineBox.value.remove()
        baseData.value.length > 0 && drawProgress(baseData.value)
        lineBox.value.style.left = `${percentStorage.value}%`
      }
    }

    const resetSelectionBox = () => {
      if (!selectionBox.value) return
      selectionBox.value.style.width = 0
      selectionBox.value.style.opacity = 0
    }

    useImperativeHandle(ref, () => ({
      drawProgress: drawProgress,
    }))

    return <div className={style.progress_box} ref={progressBox}></div>
  }
)

export default ProgressBar
