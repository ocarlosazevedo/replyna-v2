import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export interface VolumePoint {
  label: string
  received: number
  replied: number
}

interface VolumeChartProps {
  data: VolumePoint[]
}

export default function VolumeChart({ data }: VolumeChartProps) {
  const { theme } = useTheme()

  const chartColors = useMemo(() => {
    if (typeof document === 'undefined') {
      return {
        text: '#42506a',
        grid: 'rgba(215, 222, 239, 0.6)',
      }
    }
    const styles = getComputedStyle(document.documentElement)
    const text = styles.getPropertyValue('--text-secondary').trim() || '#42506a'
    const grid = styles.getPropertyValue('--border-color').trim() || 'rgba(215, 222, 239, 0.6)'
    return {
      text,
      grid,
    }
  }, [theme])

  const chartData = {
    labels: data.map((point) => point.label),
    datasets: [
      {
        label: 'Emails recebidos',
        data: data.map((point) => point.received),
        borderColor: '#9aa8c7',
        backgroundColor: 'rgba(154, 168, 199, 0.2)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Emails respondidos',
        data: data.map((point) => point.replied),
        borderColor: '#4672ec',
        backgroundColor: 'rgba(70, 114, 236, 0.18)',
        tension: 0.3,
        fill: true,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: chartColors.text,
          usePointStyle: true,
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#0e1729',
        titleColor: '#f5fafe',
        bodyColor: '#f5fafe',
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
        },
      },
      y: {
        grid: {
          color: chartColors.grid,
        },
        ticks: {
          color: chartColors.text,
          precision: 0,
        },
      },
    },
  }

  return <Line data={chartData} options={options} />
}
