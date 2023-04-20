import { round, throttle } from 'lodash'
import { getMockProgress } from '@/api/mock-api'
import useAppStore from '@/store/modules/app'
import style from './index.module.scss'

const ColorMap = require('colormap');

export default defineComponent({
  props: {
    maxDb: {
      type: Number,
      required: true,
    },
    minDb: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Object,
      required: true,
    },
  },
  emits: ['progress-change', 'progress-selected', 'cancel-select'],
  setup(props, { expose, emit }) {
    const progressBox = ref(null)
    const boxWidth = ref(0)
    const boxHeight = ref(0)
    const canvasCtx = ref(null)
    const fallsCanvasCtx = ref(null)
    const colors = ref(null)
    const baseData = ref([])

    const onWindowResize = () => {
      setProgressWidth()
    }

    const appStore = useAppStore()
    appStore.$subscribe(({events}) => {
      if (events.key === 'opened' || events.key === 'withoutAnimation') {
        setTimeout(() => {
          setProgressWidth()
        }, 500)
      }
    })

    onMounted(() => {
      if (progressBox.value.clientWidth !== 0) {
        initComponent()
      } else {
        nextTick(() => {
          initComponent()
        })
      }

      window.addEventListener('resize', onWindowResize)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('resize', onWindowResize)
    })

    const initComponent = () => {
      boxWidth.value = progressBox.value.clientWidth
      boxHeight.value = progressBox.value.clientHeight
      createCanvas()
      createFallsCanvas()
      initColors()
    }

    const createCanvas = () => {
      const canvas = document.createElement('canvas')
      canvas.className = 'progress_canvas'
      canvas.width = boxWidth.value
      canvas.height = boxHeight.value
      progressBox.value.appendChild(canvas)
      canvasCtx.value = canvas.getContext('2d')
    }
    const createFallsCanvas = () => {
      const canvas = document.createElement('canvas')
      canvas.width = boxWidth.value
      canvas.height = boxHeight.value
      fallsCanvasCtx.value = canvas.getContext('2d')
    }

    const initColors = () => {
      if (props.maxDb === undefined || props.minDb === undefined) return
      const len = props.maxDb - props.minDb
      colors.value = ColorMap({
        colormap: 'jet',
        nshades: len,
        format: 'rba',
        alpha: 1,
      })
    }

    const drawProgress = data => {
      baseData.value = data
      let len = baseData.value.length
      const scale = len / boxWidth.value
      let arr = []
      for (let i = len; i > 0; i -= scale) {
        const startIndex = round(i - scale)
        const endIndex = round(i)
        let col = baseData.value.slice(startIndex, endIndex)
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

    const lineBox = ref(null)
    const isMove = ref(false)
    const drawLineBox = () => {
      lineBox.value = document.createElement('div')
      lineBox.value.className = 'line_box'
      lineBox.value.style.height = boxHeight.value + 'px'
      progressBox.value.appendChild(lineBox.value)
      progressBox.value.addEventListener('mousedown', handlerMouseDown)
      progressBox.value.addEventListener('mousemove', throttleMouseMove)
      progressBox.value.addEventListener('mouseup', handlerMouseUp)
      progressBox.value.addEventListener('mouseleave', handlerMouseUp)
    }

    const selectionBox = ref(null)
    const drawSelectionBox = () => {
      selectionBox.value = document.createElement('div')
      selectionBox.value.className = 'selection_box'
      selectionBox.value.style.height = boxHeight.value + 'px'
      progressBox.value.appendChild(selectionBox.value)
    }

    const isSelection = ref(false)
    const operateType = ref('SELECTION')
    const beginX = ref(0)
    const endX = ref(0)
    const isClick = ref(true)
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

    const percentStorage = ref(0)
    watch(props.percentage, newValue => {
      if (isMove.value) return
      percentStorage.value = newValue
      if (lineBox.value) {
        lineBox.value.style.left = `${newValue}%`
      }
    })

    const totalCount = ref(0)

    const setLineBoxStyle = data => {
      const percent =
        (data.aggregation_frame * (data.fft_size - 0)) / totalCount.value
      const lineWidth = percent * boxWidth.value
      if (lineBox.value) {
        lineBox.value.style.width = lineWidth + 'px'
      }
    }

    const drawColImgData = data => {
      const imageData = fallsCanvasCtx.value.createImageData(1, boxHeight.value)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const cIndex = getCurrentColor(data[i / 4])
        const color = colors.value[cIndex]
        imageData.data[i + 0] = color[0]
        imageData.data[i + 1] = color[1]
        imageData.data[i + 2] = color[2]
        imageData.data[i + 3] = 255
      }
      fallsCanvasCtx.value.putImageData(imageData, 0, 0)
      // 将已生成的图像向右移动一个像素
      fallsCanvasCtx.value.drawImage(
        fallsCanvasCtx.value.canvas,
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
      const scale = len / boxHeight.value
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
      boxWidth.value = progressBox.value.clientWidth
      boxHeight.value = progressBox.value.clientHeight
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

    expose({
      setLineBoxStyle,
      drawProgress,
      resetProgress,
      setTotalCount,
      resetSelectionBox,
    })

    return () => <div class={style.progress_box} ref={progressBox}></div>
  },
})
