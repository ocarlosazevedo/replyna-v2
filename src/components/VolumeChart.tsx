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
          color: '#42506a',
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
          color: 'rgba(215, 222, 239, 0.6)',
        },
        ticks: {
          color: '#42506a',
        },
      },
      y: {
        grid: {
          color: 'rgba(215, 222, 239, 0.6)',
        },
        ticks: {
          color: '#42506a',
          precision: 0,
        },
      },
    },
  }

  return <Line data={chartData} options={options} />
}
