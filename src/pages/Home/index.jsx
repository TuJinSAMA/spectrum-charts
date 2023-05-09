import React, { useState, useEffect, useRef } from 'react'
import { Button } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import ProgressBar from '@/components/ProgressBar'
import SpectrumChart from '@/components/SpectrumChart'
import FallsChart from '@/components/FallsChart'
import style from './index.module.styl'

const Home = () => {
  const [chartData, setChartData] = useState(() => [])
  const [percentage, setPercentage] = useState(0)

  const spectrumChartRef = useRef(null)
  const fallsChartRef = useRef(null)
  const progressBarRef = useRef(null)

  const interval = useRef(null)

  // 初始化 获取数据
  const init = () => {
    useEffect(() => {
      fetch('data/data.json')
        .then(response => response.json())
        .then(json => {
          setChartData(json)
        })
      fetch('data/progress.json')
        .then(response => response.json())
        .then(json => {
          const data = json.map(item => Object.values(item))
          progressBarRef.current && progressBarRef.current.drawProgress(data)
        })
    }, [])
  }

  // 播放
  const handlerPlay = () => {
    if (spectrumChartRef.current && fallsChartRef.current) {
      createInterval(chartData)
    }
  }

  // 暂停
  const handlerPause = () => {
    clearInterval(interval.current)
  }

  const createInterval = (data, time = 30) => {
    console.log(data)
    let i = 0
    interval.current = setInterval(() => {
      if (i === data.length - 1) return clearInterval(interval.current)
      // 计算当前播放的进度
      const { SampleIndex, TotalSamplesCount } = data[i]
      const percentage = (SampleIndex / TotalSamplesCount) * 100
      // 设置进度 触发进度条指示器位移
      setPercentage(percentage)
      // 更新频谱图和瀑布图
      spectrumChartRef.current.updateChart(data[i])
      fallsChartRef.current.updateChart(data[i])
      i++
    }, 30)
  }

  init()

  // useEffect(() => {
  //   console.log(chartList);
  //   console.log(progressBarList);
  // }, [chartList, progressBarList])

  return (
    <div className={style.container}>
      <div className={style.main}>
        <div className={style.play_group}>
          <Button
            ghost
            size="small"
            onClick={handlerPlay}
            icon={<PlayCircleOutlined />}
          >
            开始播放
          </Button>
          <Button
            ghost
            size="small"
            onClick={handlerPause}
            icon={<PauseCircleOutlined />}
          >
            暂停播放
          </Button>
        </div>
        <div className={style.charts_box}>
          <ProgressBar ref={progressBarRef} percentage={percentage} />
          <SpectrumChart
            yAxisMax={0}
            yAxisMin={-140}
            yTitle="电平(dBm)"
            selection={true}
            height={250}
            ref={spectrumChartRef}
          />
          <FallsChart
            title="瀑布图(dBm)"
            maxDb={0}
            minDb={-140}
            height={250}
            ref={fallsChartRef}
          />
        </div>
      </div>
    </div>
  )
}

export default Home
