import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { useMemo } from 'react'
import { useTheme } from '../context/ThemeContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

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

  // Sempre usar gráfico de barras
  const useBarChart = true

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

  // Calcular o máximo para ter uma escala adequada
  const maxValue = Math.max(
    ...data.map((point) => Math.max(point.received, point.replied)),
    1 // Mínimo de 1 para evitar gráfico vazio
  )

  const chartData = useBarChart
    ? {
        labels: data.map((point) => point.label),
        datasets: [
          {
            label: 'Emails recebidos',
            data: data.map((point) => point.received),
            backgroundColor: 'rgba(154, 168, 199, 0.7)',
            borderColor: '#9aa8c7',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Emails respondidos',
            data: data.map((point) => point.replied),
            backgroundColor: 'rgba(70, 114, 236, 0.7)',
            borderColor: '#4672ec',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      }
    : {
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
          padding: 24,
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
        min: 0,
        suggestedMax: Math.ceil(maxValue * 1.2), // 20% acima do máximo para melhor visualização
      },
    },
  }

  return useBarChart ? <Bar data={chartData} options={options} /> : <Line data={chartData} options={options} />
}
