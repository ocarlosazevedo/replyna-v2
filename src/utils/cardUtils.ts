export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard' | 'unknown'

const ELO_RANGES = [
  '401178', '401179', '431274', '438935', '451416', '457393', '457631',
  '457632', '504175', '506699', '506770', '506771', '506772', '506773',
  '506774', '506775', '506776', '506777', '506778', '509000', '509001',
  '509002', '509003', '627780', '636297', '636368', '650031', '650032',
  '650033', '650035', '650036', '650037', '650038', '650039', '650040',
  '650041', '650042', '650043', '650044', '650045', '650046', '650047',
  '650048', '650049', '650050', '650051', '650405', '650406', '650407',
  '650408', '650409', '650410', '650411', '650412', '650413', '650414',
  '650415', '650416', '650417', '650418', '650419', '650420', '650421',
  '650422', '650423', '650424', '650425', '650426', '650427', '650428',
  '650429', '650430', '650431', '650432', '650433', '650434', '650435',
  '650436', '650437', '650438', '650439', '650485', '650486', '650487',
  '650488', '650489', '650490', '650491', '650492', '650493', '650494',
  '650495', '650496', '650497', '650498', '650499', '650500', '650501',
  '650502', '650503', '650504', '650505', '650506', '650507', '650508',
  '650509', '650510', '650511', '650512', '650513', '650514', '650515',
  '650516', '650517', '650518', '650519', '650520', '650521', '650522',
  '650523', '650524', '650525', '650526', '650527', '650528', '650529',
  '650530', '650531', '650532', '650533', '650534', '650535', '650901',
  '650902', '650903', '650904', '650905', '650906', '650907', '650908',
  '650909', '650910', '650911', '650912', '650913', '650914', '650915',
  '650916', '650917', '650918', '650919', '650920',
]

export function detectCardBrand(number: string): CardBrand {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 1) return 'unknown'

  // Check Elo first (specific BIN ranges)
  const bin6 = digits.substring(0, 6)
  if (ELO_RANGES.includes(bin6)) return 'elo'

  // Hipercard
  if (digits.startsWith('606282')) return 'hipercard'

  // Amex: 34, 37
  if (/^3[47]/.test(digits)) return 'amex'

  // Mastercard: 51-55, 2221-2720
  const twoDigit = parseInt(digits.substring(0, 2), 10)
  const fourDigit = parseInt(digits.substring(0, 4), 10)
  if ((twoDigit >= 51 && twoDigit <= 55) || (fourDigit >= 2221 && fourDigit <= 2720)) {
    return 'mastercard'
  }

  // Visa: starts with 4
  if (digits.startsWith('4')) return 'visa'

  return 'unknown'
}

export function formatCardNumber(value: string, brand?: CardBrand): string {
  const digits = value.replace(/\D/g, '')
  const detectedBrand = brand || detectCardBrand(digits)

  if (detectedBrand === 'amex') {
    // 4-6-5 format
    const maxLen = Math.min(digits.length, 15)
    const parts: string[] = []
    if (maxLen > 0) parts.push(digits.substring(0, Math.min(4, maxLen)))
    if (maxLen > 4) parts.push(digits.substring(4, Math.min(10, maxLen)))
    if (maxLen > 10) parts.push(digits.substring(10, 15))
    return parts.join(' ')
  }

  // 4-4-4-4 format
  const maxLen = Math.min(digits.length, 16)
  const parts: string[] = []
  for (let i = 0; i < maxLen; i += 4) {
    parts.push(digits.substring(i, Math.min(i + 4, maxLen)))
  }
  return parts.join(' ')
}

export function getCardNumberMaxLength(brand: CardBrand): number {
  return brand === 'amex' ? 15 : 16
}

export function getCvvLength(brand: CardBrand): number {
  return brand === 'amex' ? 4 : 3
}

export function isInternationalCard(bin: string): boolean {
  const digits = bin.replace(/\D/g, '').substring(0, 6)
  if (digits.length < 6) return false

  // Known Brazilian BIN prefixes (Elo, Hipercard are always Brazilian)
  if (ELO_RANGES.includes(digits)) return false
  if (digits.startsWith('606282')) return false

  // Brazilian Visa/Master BINs typically start with specific ranges
  // For simplicity, we consider Elo and Hipercard as Brazilian
  // Visa/Master/Amex could be either - we check common Brazilian ranges
  const brazilianPrefixes = [
    '401178', '401179', '431274', '438935', '451416', '457393',
    '489631', '489632', '489633', '498405', '498410', '498411',
    '498412', '498418', '498419', '498420', '498421', '498422',
    '498427', '498428', '498429', '498432', '498433', '498472',
    '498473', '511916', '516292', '516309', '516310', '516326',
    '516398', '516399', '516406', '516412', '516413', '516416',
    '523078', '523143', '523731', '524024', '524025', '526383',
    '526384', '527378', '541098', '546386', '546496',
  ]

  if (brazilianPrefixes.includes(digits)) return false

  // If we can't determine, default to not international (most users will be Brazilian)
  return false
}

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.substring(0, 5)}-${digits.substring(5)}`
}

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.substring(0, 3)}.${digits.substring(3)}`
  if (digits.length <= 9) return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6)}`
  return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9)}`
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.substring(0, 2)}.${digits.substring(2)}`
  if (digits.length <= 8) return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5)}`
  if (digits.length <= 12) return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8)}`
  return `${digits.substring(0, 2)}.${digits.substring(2, 5)}.${digits.substring(5, 8)}/${digits.substring(8, 12)}-${digits.substring(12)}`
}

export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) return formatCPF(value)
  return formatCNPJ(value)
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(digits[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10) rest = 0
  if (rest !== parseInt(digits[10])) return false

  return true
}

export function formatExpiryDate(value: string): string {
  const digits = value.replace(/\D/g, '').substring(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.substring(0, 2)}/${digits.substring(2)}`
}

export function parseExpiryDate(value: string): { month: string; year: string } {
  const digits = value.replace(/\D/g, '')
  return {
    month: digits.substring(0, 2),
    year: digits.length >= 4 ? `20${digits.substring(2, 4)}` : '',
  }
}
