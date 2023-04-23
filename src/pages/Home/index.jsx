import React, { useState, useEffect, useRef } from 'react'
import { Button } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import ProgressBar from '@/components/ProgressBar'
import SpectrumChart from '@/components/SpectrumChart'
import FallsChart from '@/components/FallsChart'
import style from './index.module.styl'

const Home = () => {
  const [chartList, setChartList] = useState(() => [])
  const [progressBarList, setProgressBarList] = useState(() => [])

  const spectrumChartRef = useRef(null)

  const init = () => {
    useEffect(() => {
      fetch('data/data.json')
        .then(response => response.json())
        .then(json => {
          setChartList(json)
        })
      fetch('data/progress.json')
        .then(response => response.json())
        .then(json => {
          setProgressBarList(json)
        })
    }, [])
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
          <Button ghost size="small" icon={<PlayCircleOutlined />}>
            开始播放
          </Button>
          <Button ghost size="small" icon={<PauseCircleOutlined />}>
            暂停播放
          </Button>
        </div>
        <div className={style.charts_box}>
          <ProgressBar />
          <SpectrumChart
            yAxisMax={0}
            yAxisMin={-140}
            yTitle="电平(dBm)"
            selection={true}
            height={250}
          />
          <FallsChart title="瀑布图(dBm)" maxDb={0} minDb={-140} height={250} />
        </div>
      </div>
    </div>
  )
}

export default Home
