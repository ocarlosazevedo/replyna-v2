import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  MapPin,
  Menu,
  PhoneCall,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'

const glossaryItems = [
  {
    id: 'glossario-settlement',
    term: 'Settlement',
    definition:
      'Tempo de processamento do repasse. É o prazo entre a venda acontecer e o dinheiro cair na sua conta. Na Shopify, esse prazo varia de 2 a 7 dias úteis dependendo do país e do histórico da conta.',
  },
  {
    id: 'glossario-merchant',
    term: 'Merchant',
    definition:
      'Lojista ou comerciante online. É quem vende o produto e recebe o pagamento. No contexto de chargebacks, o merchant é quem sofre o prejuízo quando uma disputa é aberta.',
  },
  {
    id: 'glossario-gateway',
    term: 'Gateway de pagamento',
    definition:
      'Processador que faz a intermediação entre a loja, o banco do cliente e o banco do lojista. Exemplos: Shopify Payments, Stripe, PayPal. É o gateway que debita o valor do chargeback da conta do lojista.',
  },
  {
    id: 'glossario-friendly-fraud',
    term: 'Friendly fraud',
    definition:
      'Fraude amigável. Quando o próprio dono do cartão fez a compra mas contesta como se não reconhecesse. Pode ser por esquecimento, arrependimento ou má-fé. Representa a maioria dos chargebacks no e-commerce.',
  },
  {
    id: 'glossario-chargeback-ratio',
    term: 'Chargeback ratio',
    definition:
      'Taxa de chargeback. É a porcentagem de chargebacks em relação ao total de transações processadas num período. Exemplo: 10 chargebacks em 1.000 pedidos = 1% de chargeback ratio. As bandeiras monitoram esse número para decidir se a loja entra em programa de penalidade.',
  },
  {
    id: 'glossario-rolling-reserve',
    term: 'Rolling reserve',
    definition:
      'Reserva rolante. Uma porcentagem de cada venda que o gateway retém como garantia por um período (geralmente 30 a 90 dias). Se houver chargebacks, o gateway usa essa reserva para cobrir. É aplicada em contas consideradas de alto risco.',
  },
  {
    id: 'glossario-vamp',
    term: 'VAMP',
    definition:
      'Visa Acquirer Monitoring Program. Programa da Visa que monitora a taxa de fraudes e disputas dos merchants. Substituiu os antigos VDMP e VFMP em abril de 2025. Merchants que ultrapassam o limite de 1.5% (caindo para 0.9% em 2026) são classificados como "Excessive" e pagam multa de $10 USD por disputa.',
  },
  {
    id: 'glossario-ecm',
    term: 'ECM',
    definition:
      'Excessive Chargeback Merchant. Programa da Mastercard que monitora merchants com taxa de chargeback acima de 1.5% ou mais de 100 chargebacks por mês. Multas podem chegar a $200.000 USD.',
  },
  {
    id: 'glossario-ticket-medio',
    term: 'Ticket médio',
    definition:
      'Valor médio por pedido na sua loja. Calculado dividindo o faturamento total pelo número de pedidos. Exemplo: R$30.000 em vendas ÷ 200 pedidos = ticket médio de R$150.',
  },
  {
    id: 'glossario-d3',
    term: 'D+3',
    definition:
      'Modelo de recebimento onde o lojista recebe o dinheiro da venda 3 dias úteis depois da transação. O "D" significa o dia da venda (dia zero) e o "+3" os dias úteis até o repasse. Na Shopify Payments, o settlement varia por país: EUA/Austrália recebem em D+2, Europa/Canadá em D+3, Hong Kong/Singapura em D+4. Merchants novos podem começar com D+7.',
  },
]

const faqItems = [
  {
    question: 'O que é chargeback?',
    answer:
      'Chargeback é quando o cliente contesta uma compra diretamente com o banco ou a operadora do cartão, pedindo o dinheiro de volta sem falar com a loja.',
  },
  {
    question: 'Qual a diferença entre chargeback, estorno e reembolso?',
    answer:
      'Reembolso é devolução voluntária feita pela loja. Estorno é reversão por erro técnico do gateway ou banco. Chargeback é disputa iniciada pelo cliente junto ao banco, com taxa e impacto na conta do lojista.',
  },
  {
    question: 'Qual o limite aceitável de taxa de chargeback?',
    answer:
      'Recomendamos manter a taxa abaixo de 0.5% do total de transações. Acima disso, a loja pode entrar em programas de monitoramento e sofrer retenções ou multas.',
  },
  {
    question: 'Quanto custa um chargeback para a loja?',
    answer:
      'Além do valor da venda, o lojista perde o custo do produto, paga a taxa do gateway e gasta tempo operacional para responder a disputa.',
  },
  {
    question: 'Como prevenir chargebacks no e-commerce?',
    answer:
      'Responder rápido, oferecer rastreio visível, ter política de devolução clara, descrição precisa e atendimento proativo são as ações mais eficazes.',
  },
]

type CurrencyOption = {
  code: string
  symbol: string
  flag: string
  countryName: string
  currencyName: string
  searchValue: string
}

const currencyRegionOverrides: Record<string, string> = {
  EUR: 'EU',
}

const ISO_CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD',
  'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP',
  'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR',
  'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS',
  'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP',
  'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN',
  'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG',
  'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC',
  'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD',
  'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST',
  'XAF', 'XCD', 'XCG', 'XDR', 'XOF', 'XPF', 'XSU', 'YER', 'ZAR', 'ZMW',
  'ZWG', 'ZWL',
]

const getRegionForCurrency = (code: string) => {
  const override = currencyRegionOverrides[code]
  if (override) return override
  if (code.startsWith('X')) return 'UN'
  const region = code.slice(0, 2).toUpperCase()
  if (/^[A-Z]{2}$/.test(region)) return region
  return 'UN'
}

const getFlagEmoji = (regionCode: string) => {
  if (!regionCode) return '🏳️'
  const base = 0x1f1e6
  const chars = regionCode.toUpperCase().split('')
  if (chars.length !== 2) return '🏳️'
  return String.fromCodePoint(base + chars[0].charCodeAt(0) - 65, base + chars[1].charCodeAt(0) - 65)
}

const getCurrencySymbol = (code: string) => {
  try {
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    })
    const parts = formatter.formatToParts(1)
    const currencyPart = parts.find((part) => part.type === 'currency')
    return currencyPart?.value ?? code
  } catch {
    return code
  }
}

const getSupportedCurrencyCodes = () => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (type: string) => string[] }
  const supported = intl.supportedValuesOf ? intl.supportedValuesOf('currency') : []
  if (supported.length) {
    return Array.from(new Set([...supported, ...ISO_CURRENCY_CODES]))
  }
  return ISO_CURRENCY_CODES
}

const formatCount = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)

const formatRatio = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(value)

const formatPercent = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)

const parseNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed
  const number = Number(normalized.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

const getAppUrl = (path: string) => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return path
  }
  return `https://app.replyna.me${path}`
}

const getLandingUrl = (path: string) => {
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return path
  }
  return `https://replyna.me${path}`
}

function GlossaryLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className="lp-glossary-link"
    >
      {children}
    </a>
  )
}

export default function ChargebackPage() {
  const [ticketMedioInput, setTicketMedioInput] = useState('')
  const [pedidosInput, setPedidosInput] = useState('')
  const [taxaInput, setTaxaInput] = useState('')
  const [custoInput, setCustoInput] = useState('25')
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState('BRL')
  const [currencyQuery, setCurrencyQuery] = useState('')
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const currencyDropdownRef = useRef<HTMLDivElement>(null)

  const currencyOptions = useMemo<CurrencyOption[]>(() => {
    const codes = getSupportedCurrencyCodes()
    const currencyNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['pt-BR'], { type: 'currency' })
      : null
    const regionNames = typeof Intl.DisplayNames === 'function'
      ? new Intl.DisplayNames(['pt-BR'], { type: 'region' })
      : null

    return codes
      .map((code) => {
        const region = getRegionForCurrency(code)
        const flag = getFlagEmoji(region)
        const currencyName = currencyNames?.of(code) ?? code
        const countryName = regionNames?.of(region) ?? region
        const symbol = getCurrencySymbol(code)
        const searchValue = `${code} ${currencyName} ${countryName}`.toLowerCase()
        return {
          code,
          symbol,
          flag,
          countryName,
          currencyName,
          searchValue,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [])

  const selectedCurrencyOption = useMemo(() => {
    return (
      currencyOptions.find((option) => option.code === selectedCurrency) ?? {
        code: selectedCurrency,
        symbol: selectedCurrency,
        flag: '🏳️',
        countryName: '',
        currencyName: selectedCurrency,
        searchValue: selectedCurrency.toLowerCase(),
      }
    )
  }, [currencyOptions, selectedCurrency])

  const filteredCurrencies = useMemo(() => {
    const query = currencyQuery.trim().toLowerCase()
    if (!query) return currencyOptions
    return currencyOptions.filter((option) => option.searchValue.includes(query))
  }, [currencyOptions, currencyQuery])

  const formatCurrency = (value: number, currencyCode = selectedCurrency, options?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
      ...options,
    }).format(value)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!currencyOptions.length) return
    const hasSelected = currencyOptions.some((option) => option.code === selectedCurrency)
    if (!hasSelected) {
      setSelectedCurrency(currencyOptions[0].code)
    }
  }, [currencyOptions, selectedCurrency])

  useEffect(() => {
    if (!currencyMenuOpen) return
    const handleClick = (event: MouseEvent) => {
      if (!currencyDropdownRef.current) return
      const target = event.target as Node
      if (!currencyDropdownRef.current.contains(target)) {
        setCurrencyMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [currencyMenuOpen])

  useEffect(() => {
    const previousTitle = document.title
    const previousDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content')
    const previousCanonical = document
      .querySelector('link[rel="canonical"]')
      ?.getAttribute('href')

    document.title = 'Chargeback: O Que É, Como Prevenir e Calculadora Gratuita | Replyna'

    let metaDescription = document.querySelector('meta[name="description"]') as
      | HTMLMetaElement
      | null
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.name = 'description'
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute(
      'content',
      'Descubra o que é chargeback, quanto custa para sua loja e como reduzir em até 91%. Use nossa calculadora gratuita e proteja sua operação de e-commerce.',
    )
    metaDescription.dataset.chargeback = 'true'

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = 'https://replyna.me/chargeback'
    canonical.dataset.chargeback = 'true'

    return () => {
      document.title = previousTitle
      if (metaDescription) {
        if (previousDescription !== null && previousDescription !== undefined) {
          metaDescription.setAttribute('content', previousDescription)
        } else if (metaDescription.dataset.chargeback === 'true') {
          metaDescription.remove()
        }
      }
      if (canonical) {
        if (previousCanonical) {
          canonical.href = previousCanonical
        } else if (canonical.dataset.chargeback === 'true') {
          canonical.remove()
        }
      }
    }
  }, [])

  useEffect(() => {
    const scriptId = 'chargeback-faq-jsonld'
    const existingScript = document.getElementById(scriptId)
    if (existingScript) {
      existingScript.remove()
    }

    const faqJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'application/ld+json'
    script.text = JSON.stringify(faqJsonLd)
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [])

  const calculatorData = useMemo(() => {
    const isReady =
      ticketMedioInput.trim() !== '' &&
      pedidosInput.trim() !== '' &&
      taxaInput.trim() !== ''

    if (!isReady) {
      return {
        isReady: false,
        chargebacksPorMes: 0,
        prejuizoMensal: 0,
        prejuizoAnual: 0,
        chargebacksEvitados: 0,
        economiaMensal: 0,
        economiaAnual: 0,
        roiReplyna: 0,
        receitaMensal: 0,
        percentualReceitaComprometida: 0,
      }
    }

    const ticketMedio = parseNumber(ticketMedioInput)
    const pedidosPorMes = parseNumber(pedidosInput)
    const taxaChargeback = parseNumber(taxaInput)
    const custoMedioPorChargeback = custoInput.trim() === '' ? 25 : parseNumber(custoInput)

    const chargebacksPorMes = (pedidosPorMes * taxaChargeback) / 100
    const prejuizoMensal = chargebacksPorMes * (ticketMedio + custoMedioPorChargeback)
    const prejuizoAnual = prejuizoMensal * 12
    const chargebacksEvitados = chargebacksPorMes * 0.91
    const economiaMensal = chargebacksEvitados * (ticketMedio + custoMedioPorChargeback)
    const economiaAnual = economiaMensal * 12
    const roiReplyna = economiaMensal / 197
    const receitaMensal = ticketMedio * pedidosPorMes
    const percentualReceitaComprometida =
      receitaMensal > 0 ? (prejuizoMensal / receitaMensal) * 100 : 0

    return {
      isReady: true,
      chargebacksPorMes,
      prejuizoMensal,
      prejuizoAnual,
      chargebacksEvitados,
      economiaMensal,
      economiaAnual,
      roiReplyna,
      receitaMensal,
      percentualReceitaComprometida,
    }
  }, [ticketMedioInput, pedidosInput, taxaInput, custoInput])

  const handleAnchorClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return
    const target = event.target as HTMLElement | null
    const anchor = target?.closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || !href.startsWith('#')) return

    const id = href.replace('#', '')
    const element = document.getElementById(id)
    if (!element) return

    event.preventDefault()
    const headerOffset = 96
    const elementTop = element.getBoundingClientRect().top + window.scrollY
    window.scrollTo({
      top: elementTop - headerOffset,
      behavior: 'smooth',
    })
  }

  const handlePricingClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    try {
      localStorage.setItem('lp-scroll-target', 'precos')
    } catch (error) {
      // Ignore storage issues and continue with the redirect.
    }
    window.location.href = getLandingUrl('/#precos')
  }

  const shouldShowResults = calculatorData.isReady
  const rawSliderValue = taxaInput === '' ? 0 : parseNumber(taxaInput)
  const sliderValue = Math.min(10, Math.max(0, rawSliderValue))
  const sliderPercent = (sliderValue / 10) * 100
  const sliderBackground = `linear-gradient(90deg, #06b6d4 0%, #3b82f6 ${sliderPercent}%, rgba(255,255,255, 0.08) ${sliderPercent}%, rgba(255,255,255, 0.08) 100%)`
  const mesesReplyna = Math.floor(calculatorData.prejuizoAnual / 197)
  return (
    <div className="lp-container" onClick={handleAnchorClick}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        html {
          scroll-behavior: smooth;
        }

        .lp-container {
          min-height: 100vh;
          background-color: #050508;
          color: #ffffff;
          font-family: "Inter", "Manrope", "Segoe UI", sans-serif;
          overflow-x: hidden;
        }

        section[id], div[id] {
          scroll-margin-top: 110px;
        }

        .lp-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          pointer-events: none;
        }
        .lp-orb-1 {
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(70, 114, 236, 0.35) 0%, transparent 70%);
          top: -200px;
          left: -160px;
        }
        .lp-orb-2 {
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 70%);
          top: 20%;
          right: -140px;
        }

        .lp-noise {
          position: fixed;
          inset: 0;
          opacity: 0.03;
          pointer-events: none;
          z-index: 1000;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .lp-grid-pattern {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: linear-gradient(to bottom, black 0%, black 85%, transparent 100%);
          z-index: 0;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .lp-fade-in {
          animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .lp-fade-in-delay-1 { animation-delay: 0.1s; opacity: 0; }
        .lp-fade-in-delay-2 { animation-delay: 0.2s; opacity: 0; }
        .lp-fade-in-delay-3 { animation-delay: 0.35s; opacity: 0; }

        .lp-glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-card-shine {
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-card-shine::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
          transition: left 0.6s ease;
        }
        .lp-card-shine:hover::before {
          left: 100%;
        }
        .lp-card-shine:hover {
          transform: translateY(-6px);
          border-color: rgba(70, 114, 236, 0.3);
          box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 60px rgba(70, 114, 236, 0.12);
        }

        .lp-gradient-border {
          position: relative;
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
          border-radius: 20px;
        }
        .lp-gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          -webkit-mask-composite: xor;
          pointer-events: none;
        }

        .lp-btn-primary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: linear-gradient(135deg, #4672ec 0%, #3b5fd9 100%);
        }
        .lp-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-btn-primary:hover::before {
          opacity: 1;
        }
        .lp-btn-primary:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(70, 114, 236, 0.4), 0 0 20px rgba(70, 114, 236, 0.3);
        }

        .lp-btn-secondary {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .lp-btn-secondary:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-2px);
        }

        .lp-badge {
          position: relative;
          overflow: hidden;
        }
        .lp-badge::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%);
          animation: badgeShine 3s ease-in-out infinite;
        }
        @keyframes badgeShine {
          0%, 100% { transform: translateX(-100%) rotate(45deg); }
          50% { transform: translateX(100%) rotate(45deg); }
        }

        .lp-number {
          background: linear-gradient(135deg, #4672ec 0%, #8b5cf6 50%, #06b6d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-section-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 0 auto;
          max-width: 1200px;
        }

        .lp-nav-desktop {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .lp-nav-mobile-toggle {
          display: none;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 8px;
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s ease;
          position: relative;
        }
        .lp-nav-link:hover {
          color: #fff;
        }
        .lp-nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #4672ec, #8b5cf6);
          transition: width 0.3s ease;
        }
        .lp-nav-link:hover::after {
          width: 100%;
        }

        .lp-glossary-link {
          color: inherit;
          text-decoration: none;
          border-bottom: 1px dashed rgba(255,255,255,0.4);
          cursor: pointer;
          position: relative;
        }

        .cb-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 14px 16px;
          color: #fff;
          font-size: 15px;
          outline: none;
          width: 100%;
        }
        .cb-input:focus {
          border-color: rgba(70, 114, 236, 0.5);
          box-shadow: 0 0 0 3px rgba(70, 114, 236, 0.15);
        }

        .cb-currency-select {
          position: relative;
          max-width: none;
          width: 100%;
        }
        .cb-currency-label {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 10px;
          display: block;
        }
        .cb-currency-button {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #fff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cb-currency-button:hover {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.07);
        }
        .cb-currency-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
        }
        .cb-currency-flag {
          font-size: 18px;
        }
        .cb-currency-menu {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: rgba(8, 8, 14, 0.98);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 12px;
          z-index: 40;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
        }
        .cb-currency-search {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 12px;
          padding: 10px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        .cb-currency-list {
          margin-top: 12px;
          max-height: 280px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cb-currency-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: transparent;
          border: 1px solid transparent;
          color: #fff;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
        }
        .cb-currency-option:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
        }
        .cb-currency-option.active {
          background: rgba(70, 114, 236, 0.16);
          border-color: rgba(70, 114, 236, 0.4);
        }
        .cb-currency-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cb-currency-country {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
        }

        .cb-calculator-card {
          --cb-card-pad-x: 44px;
          --cb-card-pad-y: 48px;
          background: rgba(255,255,255, 0.02);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255,255,255, 0.06);
          border-radius: 20px;
          padding: var(--cb-card-pad-y) var(--cb-card-pad-x);
          position: relative;
          overflow: hidden;
        }
        .cb-card-glow-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, #06b6d4, transparent);
          opacity: 0.8;
          z-index: 1;
        }
        .cb-card-glow-blur {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.12), rgba(139,92,246,0.14), rgba(6,182,212,0.12), transparent);
          filter: blur(30px);
          opacity: 1;
          z-index: 1;
        }
        .cb-card-noise {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          mix-blend-mode: overlay;
          opacity: 0.4;
          pointer-events: none;
          z-index: 1;
        }
        .cb-card-content {
          position: relative;
          z-index: 2;
        }
        .cb-card-header {
          margin-bottom: 40px;
        }
        .cb-card-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(6,182,212, 0.7);
          margin-bottom: 8px;
        }
        .cb-card-title {
          font-size: 18px;
          font-weight: 600;
          color: rgba(255,255,255, 0.9);
        }

        .cb-input-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }
        .cb-field-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cb-field-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255,255,255, 0.40);
        }
        .cb-helper-text {
          font-size: 11px;
          color: rgba(255,255,255, 0.25);
          line-height: 1.4;
        }
        .cb-slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .cb-slider-badge {
          min-width: 56px;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(6,182,212, 0.1);
          border: 1px solid rgba(6,182,212, 0.2);
          color: #06b6d4;
          font-weight: 600;
          font-size: 12px;
          text-align: center;
        }
        .cb-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255, 0.06), transparent);
          margin: 32px 0;
        }
        .cb-cost-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
          align-items: start;
        }
        .cb-info-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 3px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255, 0.12);
          color: rgba(255,255,255,0.5);
          cursor: help;
        }
        .cb-mini-card {
          padding: 20px 24px;
          border-radius: 14px;
          background: rgba(6,182,212, 0.04);
          border: 1px solid rgba(6,182,212, 0.08);
          display: grid;
          gap: 12px;
          font-variant-numeric: tabular-nums;
        }
        .cb-mini-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(6,182,212, 0.5);
        }
        .cb-mini-proof {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
        }
        .cb-mini-proof-arrow {
          font-size: 20px;
          color: rgba(255,255,255, 0.25);
          font-weight: 600;
        }
        .cb-mini-subtitle {
          font-size: 12px;
          color: rgba(255,255,255, 0.35);
          margin-top: 8px;
          line-height: 1.4;
        }
        .cb-mini-metric {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cb-mini-label {
          font-size: 11px;
          color: rgba(255,255,255, 0.35);
        }
        .cb-mini-value {
          font-size: 20px;
          font-weight: 700;
          color: #06b6d4;
        }
        .cb-mini-divider {
          height: 1px;
          background: rgba(6,182,212, 0.12);
        }
        .cb-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          color: #4672ec;
        }
        .cb-cost-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .cb-prevent-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 20px;
        }
        .cb-prevent-card {
          flex: 0 1 calc(33.33% - 14px);
        }

        .cb-results {
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.4s ease;
          pointer-events: none;
          height: 0;
          overflow: hidden;
        }
        .cb-results.cb-results-visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
          height: auto;
          overflow: visible;
        }
        .cb-results-panel {
          position: relative;
          margin-top: 32px;
          margin-left: calc(var(--cb-card-pad-x) * -1);
          margin-right: calc(var(--cb-card-pad-x) * -1);
          margin-bottom: calc(var(--cb-card-pad-y) * -1);
          padding: 32px var(--cb-card-pad-x) 44px;
          border-radius: 0 0 20px 20px;
          z-index: 2;
        }
        .cb-results-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255, 0.12), transparent);
        }
        .cb-results-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
        }
        .cb-result-card {
          position: relative;
          border-radius: 16px;
          padding: 24px;
          overflow: hidden;
        }
        .cb-result-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          opacity: 0.6;
        }
        .cb-result-card--loss {
          background: rgba(239,68,68, 0.03);
          border: 1px solid rgba(239,68,68, 0.08);
          opacity: 0.95;
        }
        .cb-result-card--loss::before {
          background: linear-gradient(90deg, transparent, rgba(239,68,68, 0.4), transparent);
        }
        .cb-result-card--gain {
          background: rgba(16,185,129, 0.04);
          border: 1px solid rgba(16,185,129, 0.15);
        }
        .cb-result-card--gain::before {
          background: linear-gradient(90deg, transparent, rgba(16,185,129, 0.5), transparent);
        }
        .cb-result-badge {
          position: absolute;
          top: 16px;
          right: 16px;
          padding: 3px 10px;
          border-radius: 100px;
          background: rgba(16,185,129, 0.12);
          border: 1px solid rgba(16,185,129, 0.2);
          color: #34d399;
          font-size: 10px;
          font-weight: 700;
        }
        .cb-result-hero-line {
          position: absolute;
          top: -1px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(16,185,129, 0.5), transparent);
          pointer-events: none;
        }
        .cb-result-hero-blur {
          position: absolute;
          top: -30px;
          left: 0;
          right: 0;
          height: 60px;
          background: rgba(16,185,129, 0.08);
          filter: blur(25px);
          pointer-events: none;
        }
        .cb-result-content {
          position: relative;
          z-index: 1;
        }
        .cb-result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .cb-result-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cb-result-icon--loss {
          background: rgba(239,68,68, 0.1);
          color: #f87171;
        }
        .cb-result-icon--gain {
          background: rgba(16,185,129, 0.12);
          color: #34d399;
        }
        .cb-result-title {
          font-size: 15px;
          font-weight: 700;
        }
        .cb-result-title--loss {
          color: #f87171;
        }
        .cb-result-title--gain {
          color: #34d399;
        }
        .cb-result-metrics {
          display: grid;
          gap: 20px;
        }
        .cb-result-label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
        }
        .cb-result-number-large {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.1;
        }
        .cb-result-number-small {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.1;
        }
        .cb-result-months {
          font-size: 28px;
          font-weight: 800;
          color: #f87171;
          line-height: 1.1;
        }
        .cb-result-months-note {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255, 0.35);
          margin-top: 4px;
        }
        .cb-result-value {
          font-size: 28px;
          font-weight: 700;
        }
        .cb-result-value--loss {
          color: #f87171;
        }
        .cb-result-value--gain {
          color: #34d399;
        }
        .cb-result-divider {
          height: 1px;
          background: rgba(239,68,68, 0.08);
        }
        .cb-result-divider--gain {
          background: rgba(16,185,129, 0.12);
        }
        .cb-result-total {
          font-size: 32px;
          font-weight: 800;
        }
        .cb-result-total--loss {
          color: #f87171;
        }
        .cb-result-total--gain {
          color: #34d399;
        }
        .cb-roi-card {
          margin-top: 24px;
          padding: 16px 20px;
          border-radius: 12px;
          background: rgba(16,185,129, 0.06);
          border: 1px solid rgba(16,185,129, 0.1);
          display: grid;
          gap: 6px;
          text-align: center;
        }
        .cb-roi-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(16,185,129, 0.5);
        }
        .cb-roi-value {
          font-size: 28px;
          font-weight: 800;
          color: #34d399;
        }
        .cb-roi-subtitle {
          font-size: 11px;
          color: rgba(16,185,129, 0.6);
        }

        .cb-cta-primary {
          flex: 1;
          padding: 16px 28px;
          border-radius: 14px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          text-align: center;
          box-shadow: 0 4px 20px rgba(16,185,129, 0.25), 0 0 40px rgba(16,185,129, 0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .cb-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(16,185,129, 0.35), 0 0 50px rgba(16,185,129, 0.2);
        }
        .cb-cta-secondary {
          padding: 16px 28px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255, 0.1);
          background: rgba(255,255,255, 0.03);
          color: rgba(255,255,255, 0.7);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s ease;
        }
        .cb-cta-secondary:hover {
          border-color: rgba(255,255,255, 0.3);
          color: #fff;
        }
        .cb-disclaimer {
          font-size: 11px;
          color: rgba(255,255,255, 0.2);
        }

        .cb-glossary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .cb-three-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .cb-steps-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 18px;
        }

        .cb-inline-link {
          color: #fff;
          text-decoration: none;
          border-bottom: 1px dashed rgba(255,255,255,0.4);
        }
        .cb-inline-link:hover {
          color: #06b6d4;
        }

        .cb-range {
          width: 100%;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255, 0.08);
          flex: 1;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
        }
        .cb-range::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #67e8f9, #06b6d4);
          border: 1px solid rgba(6,182,212, 0.4);
          box-shadow: 0 0 12px rgba(6,182,212, 0.6);
          cursor: pointer;
        }
        .cb-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #67e8f9, #06b6d4);
          border: 1px solid rgba(6,182,212, 0.4);
          box-shadow: 0 0 12px rgba(6,182,212, 0.6);
          cursor: pointer;
        }

        .lp-whatsapp-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 60px;
          height: 60px;
          background: #25D366;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(37, 211, 102, 0.3);
          z-index: 100;
          transition: all 0.3s ease;
          text-decoration: none;
        }
        .lp-whatsapp-btn:hover {
          transform: scale(1.08);
          box-shadow: 0 15px 35px rgba(37, 211, 102, 0.4);
        }
        .lp-whatsapp-btn::before,
        .lp-whatsapp-btn::after {
          content: '';
          position: absolute;
          border: 1px solid rgba(37, 211, 102, 0.3);
          border-radius: 50%;
          animation: pulse 2s linear infinite;
        }
        .lp-whatsapp-btn::after {
          animation-delay: 1s;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .lp-whatsapp-tooltip {
          position: absolute;
          right: 75px;
          background: #fff;
          color: #333;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          white-space: nowrap;
          opacity: 0;
          transform: translateX(10px);
          transition: all 0.3s ease;
        }
        .lp-whatsapp-tooltip::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          transform: translateY(-50%);
          border: 6px solid transparent;
          border-left-color: #fff;
          border-right: none;
        }
        .lp-whatsapp-btn:hover .lp-whatsapp-tooltip {
          opacity: 1;
          transform: translateX(0);
        }

        @media (max-width: 1280px) {
          .cb-steps-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 1024px) {
          .lp-nav-desktop {
            gap: 20px;
          }
          .cb-cost-cards-grid {
            grid-template-columns: 1fr;
          }
          .cb-prevent-card {
            flex-basis: 100%;
          }
          .cb-input-grid {
            grid-template-columns: 1fr;
          }
          .cb-cost-grid {
            grid-template-columns: 1fr;
          }
          .cb-results-grid {
            grid-template-columns: 1fr;
          }
          .cb-three-grid {
            grid-template-columns: 1fr;
          }
          .cb-steps-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .lp-nav-desktop {
            display: none;
          }
          .lp-nav-mobile-toggle {
            display: block;
          }
          .cb-calculator-card {
            --cb-card-pad-x: 24px;
            --cb-card-pad-y: 32px;
          }
          .cb-glossary-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .cb-steps-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="lp-noise" />

      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: scrolled ? 'rgba(5, 5, 8, 0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.05)' : 'none',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto' }} />
          </a>

          <nav className="lp-nav-desktop">
            <a href="/chargeback" className="lp-nav-link">
              Calculadora
            </a>
            <a href="/#como-funciona" className="lp-nav-link">
              Como funciona
            </a>
            <a href="/#precos" className="lp-nav-link">
              Preços
            </a>
            <a href="/#faq" className="lp-nav-link">
              FAQ
            </a>
            <a href="https://app.replyna.me/login" className="lp-nav-link">
              Entrar
            </a>
            <a
              href="https://replyna.me/#precos"
              className="lp-btn-primary"
              style={{
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Começar agora
            </a>
          </nav>

          <button
            className="lp-nav-mobile-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 5, 8, 0.98)',
            backdropFilter: 'blur(20px)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '48px',
            }}
          >
            <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '32px', width: 'auto' }} />
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
            <a
              href="/chargeback"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Calculadora
            </a>
            <a
              href="/#como-funciona"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Como funciona
            </a>
            <a
              href="/#precos"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Preços
            </a>
            <a
              href="/#faq"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              FAQ
            </a>
            <a
              href="https://app.replyna.me/login"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                color: '#fff',
                textDecoration: 'none',
                fontSize: '20px',
                fontWeight: 500,
                padding: '20px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              Entrar
            </a>
          </nav>

          <a
            href="https://replyna.me/#precos"
            className="lp-btn-primary"
            style={{
              color: '#ffffff',
              padding: '18px 24px',
              borderRadius: '14px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
              textAlign: 'center',
              marginTop: '24px',
            }}
          >
            Começar agora
          </a>
        </div>
      )}

      <section
        id="calculadora"
        style={{
          position: 'relative',
          paddingTop: '140px',
          paddingBottom: '80px',
          overflow: 'hidden',
          background: 'linear-gradient(to bottom, #0c1220 0%, #050508 100%)',
        }}
      >
        <div className="lp-orb lp-orb-1" />
        <div className="lp-orb lp-orb-2" />
        <div className="lp-grid-pattern" />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h1
              className="lp-fade-in lp-fade-in-delay-2"
              style={{
                fontSize: 'clamp(32px, 4.5vw, 52px)',
                fontWeight: 800,
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              Quanto sua loja está perdendo com chargebacks?
            </h1>
            <p
              className="lp-fade-in lp-fade-in-delay-3"
              style={{
                fontSize: '18px',
                color: 'rgba(255,255,255,0.5)',
                maxWidth: '680px',
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              Descubra em segundos o impacto real dos chargebacks na sua operação.
            </p>
          </div>

          <div className="lp-glass" style={{ padding: '32px', borderRadius: '24px' }}>
            <div className="cb-input-grid">
              <div className="cb-field-group cb-currency-select" ref={currencyDropdownRef}>
                <span className="cb-field-label">Moeda</span>
                <button
                  type="button"
                  className="cb-currency-button"
                  onClick={() => setCurrencyMenuOpen((open) => !open)}
                >
                  <span className="cb-currency-info">
                    <span className="cb-currency-flag">{selectedCurrencyOption.flag}</span>
                    <span>
                      {selectedCurrencyOption.code} ({selectedCurrencyOption.symbol})
                    </span>
                  </span>
                  <ChevronDown size={16} />
                </button>
                {currencyMenuOpen && (
                  <div className="cb-currency-menu">
                    <input
                      className="cb-currency-search"
                      type="text"
                      placeholder="Buscar país ou moeda"
                      value={currencyQuery}
                      onChange={(event) => setCurrencyQuery(event.target.value)}
                      autoFocus
                    />
                    <div className="cb-currency-list">
                      {filteredCurrencies.length === 0 && (
                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', padding: '8px 4px' }}>
                          Nenhuma moeda encontrada.
                        </div>
                      )}
                      {filteredCurrencies.map((option) => (
                        <button
                          type="button"
                          key={option.code}
                          className={`cb-currency-option ${option.code === selectedCurrency ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedCurrency(option.code)
                            setCurrencyMenuOpen(false)
                            setCurrencyQuery('')
                          }}
                        >
                          <span className="cb-currency-flag">{option.flag}</span>
                          <div className="cb-currency-meta">
                            <span>
                              {option.code} ({option.symbol})
                            </span>
                            <span className="cb-currency-country">{option.countryName}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">
                  <GlossaryLink id="glossario-ticket-medio">Ticket médio</GlossaryLink> ({selectedCurrencyOption.symbol})
                </span>
                <input
                  className="cb-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 150"
                  value={ticketMedioInput}
                  onChange={(event) => setTicketMedioInput(event.target.value)}
                />
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">Pedidos por mês</span>
                <input
                  className="cb-input"
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 500"
                  value={pedidosInput}
                  onChange={(event) => setPedidosInput(event.target.value)}
                />
              </div>

              <div className="cb-field-group">
                <span className="cb-field-label">Taxa de chargeback atual</span>
                <div className="cb-slider-row">
                  <input
                    className="cb-range"
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={sliderValue}
                    onChange={(event) => setTaxaInput(event.target.value)}
                    style={{ background: sliderBackground }}
                  />
                  <span className="cb-slider-badge">{formatPercent(sliderValue)}%</span>
                </div>
                <p className="cb-helper-text">Shopify → Configurações → Payments → Ver repasses</p>
              </div>
            </div>

            <div className="cb-divider" />

            <div className="cb-cost-grid">
              <div className="cb-field-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="cb-field-label">
                    Custo médio por chargeback ({selectedCurrencyOption.symbol})
                  </span>
                  <span
                    className="cb-info-badge"
                    title="Inclui taxa do gateway (geralmente $15-25 USD) + custo do produto perdido + tempo operacional"
                  >
                    info
                  </span>
                </div>
                <input
                  className="cb-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 25"
                  value={custoInput}
                  onChange={(event) => setCustoInput(event.target.value)}
                />
                <p className="cb-helper-text">
                  Inclui taxa do <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> + custo do produto + tempo
                  operacional. Se não souber, {formatCurrency(25)} é estimativa conservadora.
                </p>
              </div>

            </div>

            <div className={`cb-results ${shouldShowResults ? 'cb-results-visible' : ''}`}>
              <div style={{ marginTop: '36px' }}>
                <div className="cb-results-grid">
                  <div className="lp-card-shine cb-result-card cb-result-card--loss">
                    <div className="cb-result-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <TrendingDown size={20} color="#ef4444" />
                        <span className="cb-result-title" style={{ color: '#ef4444' }}>
                          Seu prejuízo atual
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <div className="cb-result-label">Chargebacks estimados/mês</div>
                          <div className="cb-result-number-large" style={{ color: '#f87171' }}>
                            {formatCount(calculatorData.chargebacksPorMes)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Prejuízo mensal</div>
                          <div className="cb-result-number-large" style={{ color: '#ef4444' }}>
                            {formatCurrency(calculatorData.prejuizoMensal)}
                          </div>
                        </div>
                      <div>
                        <div className="cb-result-label">Prejuízo anual</div>
                        <div className="cb-result-number-small" style={{ color: '#fca5a5' }}>
                          {formatCurrency(calculatorData.prejuizoAnual)}
                        </div>
                      </div>
                      <div className="cb-result-divider" style={{ marginTop: '20px' }} />
                      <div style={{ marginTop: '20px' }}>
                        <div className="cb-result-label">Com esse valor você pagaria</div>
                        <div className="cb-result-months">{mesesReplyna}</div>
                        <div className="cb-result-months-note">meses de Replyna</div>
                      </div>
                    </div>
                  </div>
                  </div>

                  <div className="lp-card-shine cb-result-card cb-result-card--gain">
                    <div className="cb-result-hero-line" />
                    <div className="cb-result-hero-blur" />
                    <div className="cb-result-badge">até 91% redução</div>
                    <div className="cb-result-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                        <TrendingUp size={20} color="#22c55e" />
                        <span className="cb-result-title" style={{ color: '#22c55e' }}>
                          Com pós-venda automatizado
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <div className="cb-result-label">Chargebacks evitados/mês</div>
                          <div className="cb-result-number-large" style={{ color: '#22c55e' }}>
                            {formatCount(calculatorData.chargebacksEvitados)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Economia mensal</div>
                          <div className="cb-result-number-large" style={{ color: '#22c55e' }}>
                            {formatCurrency(calculatorData.economiaMensal)}
                          </div>
                        </div>
                        <div>
                          <div className="cb-result-label">Economia anual</div>
                          <div className="cb-result-number-small" style={{ color: '#86efac' }}>
                            {formatCurrency(calculatorData.economiaAnual)}
                          </div>
                        </div>
                      </div>
                      <div className="cb-roi-card">
                        <div className="cb-roi-label">ROI</div>
                        <div className="cb-roi-value">{formatRatio(calculatorData.roiReplyna)}x</div>
                        <div className="cb-roi-subtitle">Lucro líquido desde o primeiro mês</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '28px',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <a
                    href="https://replyna.me/#como-funciona"
                    className="lp-btn-secondary"
                    style={{
                      color: '#fff',
                      padding: '12px 20px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    Ver como funciona →
                  </a>
                </div>
                <p
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.45)',
                    textAlign: 'center',
                  }}
                >
                  * Baseado em caso real. Resultados podem variar de acordo com o volume e tipo de operação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-section-divider" />

      <article style={{ padding: '80px 24px' }}>
        <section id="o-que-e" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>O que é chargeback?</h2>
            <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
              Chargeback é quando o cliente contesta uma compra diretamente com o banco ou operadora do cartão, pedindo o
              dinheiro de volta. Em vez de falar com a loja, ele liga para o banco e diz que não reconhece a cobrança — ou
              que o produto não chegou, veio errado ou não era o que esperava.
            </p>
          </div>

          <div id="como-funciona" style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
              Como acontece um chargeback (passo a passo)
            </h3>
            <div className="cb-steps-grid">
              {[
                {
                  title: 'Cliente aciona o banco',
                  desc: 'O cliente entra em contato com o banco e pede a contestação da compra.',
                  icon: <PhoneCall size={24} />,
                },
                {
                  title: 'Disputa é aberta',
                  desc: (
                    <>
                      O banco abre a disputa e notifica o <GlossaryLink id="glossario-gateway">gateway</GlossaryLink>{' '}
                      de pagamento.
                    </>
                  ),
                  icon: <Bell size={24} />,
                },
                {
                  title: 'Valor é debitado',
                  desc: (
                    <>
                      O <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> debita automaticamente o valor da venda
                      + taxa.
                    </>
                  ),
                  icon: <CreditCard size={24} />,
                },
                {
                  title: 'Lojista envia provas',
                  desc: 'Você tem de 7 a 21 dias para comprovar a venda legítima.',
                  icon: <FileText size={24} />,
                },
                {
                  title: 'Bandeira decide',
                  desc: 'A operadora analisa as provas e decide em até 75 dias.',
                  icon: <Clock size={24} />,
                },
              ].map((step, index) => (
                <div key={step.title} style={{ position: 'relative', paddingTop: '12px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4672ec 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      boxShadow: '0 4px 15px rgba(70, 114, 236, 0.4)',
                      zIndex: 10,
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 20px', height: '100%' }}>
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, rgba(70, 114, 236, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '8px auto 16px',
                        color: '#4672ec',
                      }}
                    >
                      {step.icon}
                    </div>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                      {step.title}
                    </h4>
                    <p
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.45)',
                        lineHeight: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
              Chargeback, estorno e reembolso: qual a diferença?
            </h3>
            <div className="cb-three-grid">
              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <CheckCircle2 size={14} color="#22c55e" />
                  <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>REEMBOLSO</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  A loja devolve o dinheiro voluntariamente. O cliente pediu, a loja concordou e processou. Sem taxa extra,
                  sem disputa, sem dor de cabeça. É o cenário ideal.
                </p>
              </div>

              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(234, 179, 8, 0.12)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <RefreshCcw size={14} color="#eab308" />
                  <span style={{ fontSize: '12px', color: '#eab308', fontWeight: 600 }}>ESTORNO</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                O <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> ou o banco reverte a transação por erro
                técnico. Cobrança duplicada, valor errado ou falha no processamento. Não foi iniciado pelo cliente como
                reclamação — foi um problema do sistema.
                </p>
              </div>

              <div className="lp-card-shine lp-gradient-border" style={{ padding: '28px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    padding: '8px 14px',
                    borderRadius: '50px',
                    marginBottom: '18px',
                  }}
                >
                  <AlertTriangle size={14} color="#ef4444" />
                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>CHARGEBACK</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                  O cliente vai direto ao banco sem falar com a loja. O banco força a devolução, cobra uma taxa do lojista
                  ($15 USD na Shopify Payments) e o episódio fica registrado no histórico da loja. Mesmo que a disputa seja
                  vencida, ela conta na taxa de chargebacks.
                </p>
              </div>
            </div>

            <p style={{ marginTop: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.5)' }}>
              O cliente tem até 120 dias depois da compra para abrir um chargeback na maioria dos casos. Ou seja, uma venda
              que você fez há 4 meses pode virar chargeback hoje.
            </p>
          </div>
        </section>

        <section id="tipos" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>Tipos de chargeback</h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Existem 3 tipos principais:
          </p>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>Fraude real</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O cartão foi roubado ou clonado e alguém fez uma compra sem o dono saber. Esse é o caso mais óbvio, mas
                representa a minoria dos chargebacks no e-commerce.
              </p>
            </div>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>
                Fraude amigável (<GlossaryLink id="glossario-friendly-fraud">friendly fraud</GlossaryLink>)
              </strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O próprio dono do cartão fez a compra, recebeu o produto, mas contesta dizendo que não reconhece a cobrança.
                Às vezes é esquecimento, às vezes má-fé, e em muitos casos é falta de contato com a loja a tempo.
              </p>
            </div>
            <div className="lp-glass" style={{ padding: '18px 22px', borderRadius: '16px' }}>
              <strong style={{ fontSize: '16px' }}>Erro do lojista</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Cobrança duplicada, produto diferente do anunciado, entrega que não aconteceu sem comunicação ou política de
                devolução confusa.
              </p>
            </div>
          </div>

          <p style={{ marginTop: '18px', fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            O dado mais importante: 71% dos chargebacks não são fraude verdadeira. São falhas de comunicação entre a loja e
            o cliente. Quando você responde em poucas horas, o cliente resolve com você — quando não, ele liga para o banco.
          </p>
        </section>

        <section id="custos" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Quanto custa um chargeback para sua loja?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            O prejuízo de um chargeback vai muito além do valor da venda. Quando um chargeback acontece, o lojista perde em
            quatro frentes ao mesmo tempo:
          </p>

          <div className="cb-cost-cards-grid">
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <CreditCard size={22} />
              </div>
              <strong>O valor da venda + custo do produto</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O banco devolve o dinheiro para o cliente. Você já pagou o fornecedor e já despachou. Então perdeu duas
                vezes: o que pagou pelo produto e o que o cliente pagou por ele. Se o ticket era R$150 e o custo foi R$40,
                você não perdeu R$150 — perdeu R$190.
              </p>
              <p style={{ marginTop: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                O seu <GlossaryLink id="glossario-ticket-medio">ticket médio</GlossaryLink> ajuda a dimensionar esse
                prejuízo com precisão.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <FileText size={22} />
              </div>
              <strong>A taxa do <GlossaryLink id="glossario-gateway">gateway</GlossaryLink></strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                A Shopify Payments cobra $15 USD por cada chargeback disputado. Se você ganhar a disputa, a taxa é devolvida
                junto com o valor no próximo repasse. Se perder, fica com o prejuízo da taxa + venda + custo do produto.
                Outros <GlossaryLink id="glossario-gateway">gateways</GlossaryLink> cobram entre $15 e $25 USD com regras
                similares.{' '}
                <a
                  className="cb-inline-link"
                  href="https://help.shopify.com/en/manual/payments/chargebacks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Clock size={22} />
              </div>
              <strong>Custo operacional</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Cada disputa exige tempo: reunir comprovantes, montar argumentação, enviar para o{' '}
                <GlossaryLink id="glossario-gateway">gateway</GlossaryLink>, acompanhar prazo. Uma disputa pode levar de 30
                minutos a 2 horas de trabalho.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <AlertTriangle size={22} />
              </div>
              <strong>Dano acumulativo na conta Shopify Payments</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Este é o prejuízo invisível e mais perigoso. A Shopify monitora a porcentagem de chargebacks em relação ao
                total de pedidos da sua loja. Quando essa porcentagem sobe, começa uma escada de consequências.
              </p>
              <ul style={{ marginTop: '12px', paddingLeft: '18px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                <li>
                  Primeiro, a conta entra em restrição e a Shopify passa a reter parte dos repasses como reserva de
                  segurança.
                </li>
                <li>
                  Depois, seus repasses podem ser congelados. Se a operação depende desse fluxo para pagar fornecedor,
                  anúncio e estoque, tudo trava.
                </li>
                <li>
                  Em casos graves, a Shopify desativa o Shopify Payments. Você perde o processamento nativo e precisa
                  migrar para <GlossaryLink id="glossario-gateway">gateways</GlossaryLink> alternativos com taxas maiores.
                </li>
              </ul>
              <p style={{ marginTop: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                Para <GlossaryLink id="glossario-merchant">merchants</GlossaryLink> novos, o{' '}
                <GlossaryLink id="glossario-settlement">settlement</GlossaryLink> pode começar em até 7 dias úteis. Contas
                em risco podem entrar em <GlossaryLink id="glossario-rolling-reserve">rolling reserve</GlossaryLink>, onde
                uma porcentagem de cada venda fica retida por 30 a 90 dias. Em alguns países o repasse padrão já é em{' '}
                <GlossaryLink id="glossario-d3">D+3</GlossaryLink>.
              </p>
            </div>
          </div>

          <div
            className="lp-glass"
            style={{
              padding: '24px 28px',
              borderRadius: '16px',
              marginTop: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
                margin: 0,
                flex: 1,
                minWidth: '280px',
              }}
            >
              Na prática: chargeback não é só perder R$150 de uma venda. É um problema que se acumula silenciosamente até o
              dia em que sua conta trava. Se quer saber exatamente quanto sua loja está perdendo, use a calculadora
              gratuita no topo desta página.
            </p>
            <a
              href="#calculadora"
              className="lp-btn-primary"
              style={{
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              Calcular meu prejuízo
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section id="limite" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Taxa de chargeback: qual o limite aceitável?
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            Cada bandeira e <GlossaryLink id="glossario-gateway">gateway</GlossaryLink> monitora a porcentagem de
            chargebacks em relação ao total de transações da sua loja. Se você processou 1.000 pedidos e recebeu 10
            chargebacks, sua <GlossaryLink id="glossario-chargeback-ratio">chargeback ratio</GlossaryLink> é de 1%. Passar
            do limite de cada bandeira coloca o <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> em programas
            de monitoramento
            com multas progressivas — e em casos graves, sua conta é encerrada.
          </p>

          <div className="cb-three-grid">
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Visa (<GlossaryLink id="glossario-vamp">VAMP</GlossaryLink>)
              </h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Desde abril de 2025, a Visa unificou seus programas de monitoramento (VDMP e VFMP) em um único programa
                chamado <GlossaryLink id="glossario-vamp">VAMP</GlossaryLink>. Um{' '}
                <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> é classificado como "Excessive" quando a VAMP
                Ratio ultrapassa 1.5%, com mínimo de 1.500 disputas no mês. A partir de abril de 2026, esse limite cai para
                0.9% nos EUA, Canadá e Europa. Multa: $10 USD por disputa para{' '}
                <GlossaryLink id="glossario-merchant">merchants</GlossaryLink> na categoria Excessive.{' '}
                <a
                  className="cb-inline-link"
                  href="https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                Mastercard (<GlossaryLink id="glossario-ecm">ECM</GlossaryLink>)
              </h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Entra no Excessive Chargeback <GlossaryLink id="glossario-merchant">Merchant</GlossaryLink> quando a taxa
                de chargebacks ultrapassa 1.5% do total de transações ou quando ultrapassa 100 chargebacks no mês (o que
                vier primeiro). Multas começam em $1.000 e podem chegar a $200.000 USD dependendo de quanto tempo o{' '}
                <GlossaryLink id="glossario-merchant">merchant</GlossaryLink> fica no programa sem resolver.{' '}
                <a
                  className="cb-inline-link"
                  href="https://developer.paypal.com/braintree/articles/risk-and-security/card-brand-monitoring-programs/mastercard-programs/excessive-chargeback-program"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border" style={{ padding: '26px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Shopify Payments</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                A Shopify é a mais restritiva na prática para lojistas brasileiros. Ela monitora a porcentagem de
                chargebacks sobre o total de pedidos e pode colocar a conta em restrição quando essa porcentagem fica
                elevada por um período continuado. As consequências incluem retenção de repasses, análise manual de
                transações e desativação completa do Shopify Payments.{' '}
                <a
                  className="cb-inline-link"
                  href="https://help.shopify.com/en/manual/payments/chargebacks"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Fonte
                </a>
              </p>
            </div>
          </div>

          <p style={{ marginTop: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
            <strong>Qual taxa manter?</strong> Recomendamos ficar abaixo de 0.5% do total de transações. Isso significa: se
            você processa 1.000 pedidos no mês, no máximo 5 chargebacks. Essa margem mantém sua conta saudável com todas as
            bandeiras e longe de qualquer programa de monitoramento.
          </p>
        </section>

        <section id="prevenir" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Como prevenir chargebacks no e-commerce
          </h2>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: '24px' }}>
            A maioria dos chargebacks pode ser evitada antes de acontecer. As 5 práticas mais eficazes:
          </p>
          <div className="cb-prevent-grid">
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Clock size={22} />
              </div>
              <strong>Responder rápido:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                lojas que respondem emails em menos de 2 horas reduzem chargebacks em até 40%. Quem recebe resposta rápida
                resolve com a loja.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <MapPin size={22} />
              </div>
              <strong>Rastreamento visível:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                envie código de rastreio atualizado de forma proativa. A maioria dos chargebacks por “produto não recebido”
                acontece por falta de informação.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <RefreshCcw size={22} />
              </div>
              <strong>Política de devolução clara:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                quando o cliente sabe que pode devolver fácil, ele devolve pela loja. Se não sabe, abre chargeback.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <ImageIcon size={22} />
              </div>
              <strong>Descrição de produto precisa:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                fotos reais, medidas corretas e especificações detalhadas. Chargeback por “produto diferente” é 100%
                evitável.
              </p>
            </div>
            <div className="lp-card-shine lp-gradient-border cb-prevent-card" style={{ padding: '26px 24px' }}>
              <div className="cb-icon-box">
                <Zap size={22} />
              </div>
              <strong>Pós-venda automatizado com IA:</strong>
              <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
                ferramentas como a Replyna respondem emails em menos de 2 minutos com dados reais do pedido, 24 horas por
                dia. Esse pós-venda automatizado ajuda a prevenir chargebacks antes que o cliente abra uma disputa.
              </p>
            </div>
          </div>
        </section>

        <section id="caso-real" style={{ maxWidth: '1100px', margin: '0 auto 80px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 800, marginBottom: '12px' }}>
            Caso real: de 47 para 4 chargebacks em 30 dias
          </h2>
          <div className="lp-glass" style={{ padding: '28px', borderRadius: '20px' }}>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
              Uma operação de e-commerce com múltiplas lojas Shopify estava recebendo 47 chargebacks por mês. A conta
              Shopify Payments estava em risco de desativação. O tempo médio de resposta aos emails era de 8 a 12 horas —
              tempo suficiente para o cliente desistir e ligar para o banco.
            </p>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px' }}>
              Depois de implementar a Replyna como pós-venda automatizado, o tempo de resposta caiu para menos de 2 minutos.
              A IA passou a responder 100% dos emails automaticamente, em qualquer idioma, consultando dados reais do
              pedido na Shopify (status, rastreio e prazo de entrega).
            </p>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginTop: '16px' }}>
              Em 30 dias, neste caso real, os chargebacks caíram de 47 para 4. Redução de 91%. A conta Shopify Payments
              saiu da zona de risco e permaneceu ativa. O custo do pós-venda automatizado foi R$197/mês no plano Starter,
              evitando mais de R$15.000/mês em prejuízo.
            </p>
            <a
              href={getAppUrl('/register?plan=starter')}
              className="lp-btn-primary"
              style={{
                marginTop: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                borderRadius: '12px',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Quer o mesmo resultado? Comece agora por R$197/mês
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section id="glossario" style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
              Termos utilizados nesta página
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
              Explicamos cada termo técnico para você não ficar com dúvida
            </p>
          </div>

          <div className="lp-glass" style={{ padding: '24px', borderRadius: '24px' }}>
            <div className="cb-glossary-grid">
              {glossaryItems.map((item) => (
                <div
                  key={item.id}
                  id={item.id}
                  className="lp-gradient-border"
                  style={{ padding: '18px 20px' }}
                >
                  <strong style={{ fontSize: '15px' }}>{item.term}</strong>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', lineHeight: 1.6 }}>
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq-chargeback" style={{ maxWidth: '1100px', margin: '80px auto 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '10px' }}>
              Perguntas frequentes sobre chargeback
            </h2>
            <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>
              As dúvidas mais comuns respondidas de forma direta
            </p>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {faqItems.map((item, index) => (
              <div
                key={index}
                className="lp-glass"
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease',
                  borderColor: openFaq === index ? 'rgba(70, 114, 236, 0.3)' : undefined,
                }}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                    {item.question}
                  </h3>
                  <ChevronDown
                    size={20}
                    style={{
                      color: 'rgba(255,255,255,0.4)',
                      transition: 'transform 0.3s ease',
                      transform: openFaq === index ? 'rotate(180deg)' : 'rotate(0deg)',
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div
                  style={{
                    maxHeight: openFaq === index ? '200px' : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s ease',
                  }}
                >
                  <p
                    style={{
                      padding: '0 24px 20px',
                      fontSize: '15px',
                      color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {item.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="precos" style={{ maxWidth: '1100px', margin: '80px auto 0', textAlign: 'center' }}>
          <h2 style={{ fontSize: '34px', fontWeight: 800, marginBottom: '16px' }}>
            Reduza chargebacks ainda este mês
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.5)', marginBottom: '32px' }}>
            Comece agora e veja seus chargebacks despencarem com atendimento imediato e inteligente.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={getLandingUrl('/#precos')}
              onClick={handlePricingClick}
              className="lp-btn-primary"
              style={{
                color: '#fff',
                padding: '16px 32px',
                borderRadius: '14px',
                textDecoration: 'none',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Ver planos
              <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </article>

      <footer
        style={{
          padding: '40px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          marginTop: '80px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <img src="/replyna-logo.webp" alt="Replyna" style={{ height: '28px', width: 'auto', opacity: 0.6 }} />
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.3)' }}>
            © {new Date().getFullYear()} Replyna. Todos os direitos reservados.
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <a
              href="/"
              style={{
                color: 'rgba(255,255,255,0.3)',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
            >
              Home
            </a>
            <a
              href="/privacidade"
              style={{
                color: 'rgba(255,255,255,0.3)',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'color 0.2s',
              }}
            >
              Privacidade
            </a>
          </div>
        </div>
      </footer>

      <a
        href={`https://wa.me/5531973210191?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre a Replyna.')}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco pelo WhatsApp"
        className="lp-whatsapp-btn"
      >
        <span className="lp-whatsapp-tooltip">Fale conosco</span>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>
    </div>
  )
}
