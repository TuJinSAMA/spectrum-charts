import React, { useState, useEffect } from 'react'
import { Button } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import style from './index.module.styl'

const Home = () => {
  const [chartList, setChartList] = useState(() => [])
  const [progressBarList, setProgressBarList] = useState(() => [])

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

  useEffect(() => {
    console.log(chartList);
    console.log(progressBarList);
  }, [chartList, progressBarList])

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
        <div className={style.charts_box}></div>
      </div>
    </div>
  )
}

export default Home
