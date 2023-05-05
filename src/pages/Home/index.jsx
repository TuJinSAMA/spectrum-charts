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
  const fallsChartRef = useRef(null)
  const progressBarRef = useRef(null)

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
          const data = json.map((item) => Object.values(item));
          progressBarRef.current && progressBarRef.current.drawProgress(data)
        })
    }, [])
  }

  const handlerPlay = () => {
    console.log(chartList)
    console.log(progressBarList)
    console.log(spectrumChartRef.current);
    console.log(fallsChartRef.current);
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
          <Button ghost size="small" icon={<PauseCircleOutlined />}>
            暂停播放
          </Button>
        </div>
        <div className={style.charts_box}>
          <ProgressBar ref={progressBarRef} />
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
