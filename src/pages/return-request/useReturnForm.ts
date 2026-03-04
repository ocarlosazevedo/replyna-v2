import { useState, useRef, useCallback, useEffect } from 'react'
import type { ReturnStep, Order, UploadsMap, UploadKey, FormFields } from './types'
import type { Locale, TFunction } from './i18n'
import { getTranslations } from './i18n'
import { supabase } from '../../lib/supabase'

const STORAGE_KEY = 'replyna_return_form'

const initialUploads: UploadsMap = {
  product_front: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  product_back: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  defect: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  packaging: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  label: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  id_document: { file: null, previewUrl: null, serverUrl: null, uploading: false },
  proof_of_address: { file: null, previewUrl: null, serverUrl: null, uploading: false },
}

const initialFields: FormFields = {
  fullName: '',
  customerDocument: '',
  customerPhone: '',
  receiveDate: '',
  confirmOrder: false,
  returnReason: '',
  returnDescription: '',
  whenNoticed: '',
  triedResolve: '',
  resolutionAttempts: '',
  productUsed: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  confirmAddress: false,
  resolutionType: '',
  additionalComments: '',
  acceptTerms1: false,
  acceptTerms2: false,
  acceptTerms3: false,
}

function loadSaved() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const saved = loadSaved()

export function useReturnForm() {
  const [currentStep, setCurrentStep] = useState<ReturnStep>(saved?.currentStep ?? 0)
  const [customerEmail, setCustomerEmail] = useState(saved?.customerEmail ?? '')
  const [orders, setOrders] = useState<Order[]>(saved?.orders ?? [])
  const [locale, setLocale] = useState<Locale>(saved?.locale ?? 'en')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(saved?.selectedOrder ?? null)
  const [uploads, setUploads] = useState<UploadsMap>(initialUploads)

  // Manter ref atualizada para revogar URLs ao desmontar (evita memory leak)
  const uploadsRef = useRef(uploads)
  useEffect(() => { uploadsRef.current = uploads }, [uploads])
  useEffect(() => {
    return () => {
      Object.values(uploadsRef.current).forEach(u => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
      })
    }
  }, [])
  const [signature, setSignature] = useState<string | null>(saved?.signature ?? null)
  const [returnId, setReturnId] = useState<string | null>(saved?.returnId ?? null)
  const [shopName, setShopName] = useState<string | null>(saved?.shopName ?? null)
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(saved?.shopLogoUrl ?? null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<FormFields>(saved?.fields ?? initialFields)

  const t = getTranslations(locale)
  const tRef = useRef<TFunction>(t)
  useEffect(() => { tRef.current = t }, [locale])

  const startTime = useRef(Date.now())

  // Buscar nome e idioma direto do banco (rápido) + logo via edge function (em paralelo)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const shopId = urlParams.get('shop')
    if (!shopId) return

    // 1. Busca rápida: nome, idioma e logo cacheado direto do banco
    supabase
      .from('shops')
      .select('name, language, logo_url')
      .eq('id', shopId)
      .single()
      .then(({ data }) => {
        if (data?.name) setShopName(data.name)
        if (data?.language && !saved?.locale) setLocale(data.language as Locale)
        if (data?.logo_url) {
          setShopLogoUrl(data.logo_url)
          return // Logo já cacheado, não precisa buscar
        }

        // 2. Logo não cacheado: buscar via edge function (em background)
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
        const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

        fetch(`${SUPABASE_URL}/functions/v1/get-shop-public-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ shop_id: shopId }),
        })
          .then(res => res.json())
          .then(info => {
            if (info?.logo_url) setShopLogoUrl(info.logo_url)
          })
          .catch(() => {}) // Ignora erro, logo é opcional
      })
  }, [])

  // Persist form state to sessionStorage
  useEffect(() => {
    const data = { currentStep, customerEmail, orders, selectedOrder, fields, signature, returnId, locale, shopName, shopLogoUrl }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [currentStep, customerEmail, orders, selectedOrder, fields, signature, returnId, locale, shopName, shopLogoUrl])

  const updateField = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }, [])

  const goToStep = useCallback((step: ReturnStep) => {
    setCurrentStep(step)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const validateStep = useCallback((step: number): string | null => {
    const t = tRef.current
    switch (step) {
      case 2: {
        if (!fields.fullName.trim()) return t('error.fullName')
        if (!fields.customerPhone.trim()) return t('error.phone')
        if (selectedOrder?.customer_phone && fields.customerPhone.trim() !== selectedOrder.customer_phone) {
          return t('error.phoneMismatch')
        }
        return null
      }
      case 3: {
        if (!fields.receiveDate) return t('error.receiveDate')
        if (!fields.confirmOrder) return t('error.confirmOrder')
        // Parse both dates as local midnight to avoid timezone issues
        const [ry, rm, rd] = fields.receiveDate.split('-').map(Number)
        const received = new Date(ry, rm - 1, rd)
        const today = new Date()
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const daysDiff = Math.floor((todayMidnight.getTime() - received.getTime()) / (1000 * 60 * 60 * 24))
        if (daysDiff > 14) return '__OUT_OF_PERIOD__'
        return null
      }
      case 4: {
        if (!fields.returnReason) return t('error.returnReason')
        if (fields.returnDescription.trim().length < 100) return t('error.returnDescription')
        return null
      }
      case 5: {
        if (!fields.whenNoticed) return t('error.whenNoticed')
        if (!fields.triedResolve) return t('error.triedResolve')
        if (!fields.productUsed) return t('error.productUsed')
        return null
      }
      case 6: {
        const required: UploadKey[] = ['product_front', 'product_back', 'defect', 'packaging', 'label']
        const missing = required.filter(k => !uploads[k].file)
        if (missing.length > 0) return t('error.uploadAllPhotos')
        return null
      }
      case 7: {
        if (!fields.addressLine1.trim()) return t('error.address')
        if (!fields.city.trim()) return t('error.city')
        if (!fields.state.trim()) return t('error.state')
        if (!fields.zipCode.trim()) return t('error.zipCode')
        if (!fields.country.trim()) return t('error.country')
        if (!fields.confirmAddress) return t('error.confirmAddress')
        return null
      }
      case 8: {
        if (!fields.resolutionType) return t('error.resolution')
        return null
      }
      default:
        return null
    }
  }, [fields, uploads, selectedOrder])

  const validateAndNext = useCallback((currentStepNum: number) => {
    const validationError = validateStep(currentStepNum)
    if (validationError === '__OUT_OF_PERIOD__') {
      goToStep('out-of-period')
      return
    }
    if (validationError) {
      setError(validationError)
      return
    }
    goToStep((currentStepNum + 1) as ReturnStep)
  }, [validateStep, goToStep])

  const searchOrders = useCallback(async () => {
    if (!customerEmail.trim()) {
      setError(tRef.current('error.enterEmail'))
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customerEmail)) {
      setError(tRef.current('error.invalidEmail'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const urlParams = new URLSearchParams(window.location.search)
      const shopId = urlParams.get('shop')

      if (!shopId) {
        setError(tRef.current('error.enterEmail'))
        return
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${SUPABASE_URL}/functions/v1/search-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ shop_id: shopId, email: customerEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || tRef.current('error.noOrders'))
        return
      }

      if (data.language) setLocale(data.language as Locale)

      const fetchedOrders: Order[] = data.orders || []

      if (fetchedOrders.length === 0) {
        setError(tRef.current('error.noOrders'))
        return
      }

      setOrders(fetchedOrders)
      goToStep(1)
    } catch {
      setError(tRef.current('error.genericError'))
    } finally {
      setIsLoading(false)
    }
  }, [customerEmail, goToStep])

  const selectOrder = useCallback((index: number) => {
    const order = orders[index]
    if (order.existing_return_status) return
    setSelectedOrder(order)

    if (order.customer_name) {
      setFields(prev => ({ ...prev, fullName: order.customer_name }))
    }
    if (order.shipping_address) {
      setFields(prev => ({
        ...prev,
        addressLine1: order.shipping_address?.address1 || '',
        addressLine2: order.shipping_address?.address2 || '',
        city: order.shipping_address?.city || '',
        state: order.shipping_address?.province || '',
        zipCode: order.shipping_address?.zip || '',
        country: order.shipping_address?.country || '',
      }))
    }
  }, [orders])

  const handleFileUpload = useCallback(async (key: UploadKey, file: File) => {
    const isDocument = key === 'id_document' || key === 'proof_of_address'
    const isValidImage = file.type.startsWith('image/')
    const isValidPDF = file.type === 'application/pdf'

    if (isDocument) {
      if (!isValidImage && !isValidPDF) {
        setError(tRef.current('error.imageOrPdf'))
        return
      }
    } else {
      if (!isValidImage) {
        setError(tRef.current('error.imageOnly'))
        return
      }
    }

    const maxSize = isValidPDF ? 10 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError(tRef.current('error.fileTooLarge', { size: isValidPDF ? '10MB' : '5MB' }))
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setUploads(prev => ({
      ...prev,
      [key]: { file, previewUrl, serverUrl: null, uploading: true },
    }))
    setError(null)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-filename': file.name },
        body: file,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')

      setUploads(prev => ({
        ...prev,
        [key]: { ...prev[key], serverUrl: data.url, uploading: false },
      }))
    } catch {
      // API not available — upload to Supabase Storage directly
      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
        const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs'
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `${Date.now()}_${key}.${ext}`

        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/return-forms/${path}`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': file.type,
          },
          body: file,
        })

        if (uploadRes.ok) {
          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/return-forms/${path}`
          setUploads(prev => ({
            ...prev,
            [key]: { ...prev[key], serverUrl: publicUrl, uploading: false },
          }))
        } else {
          setUploads(prev => ({
            ...prev,
            [key]: { ...prev[key], uploading: false },
          }))
        }
      } catch {
        setUploads(prev => ({
          ...prev,
          [key]: { ...prev[key], uploading: false },
        }))
      }
    }
  }, [])

  const removeUpload = useCallback((key: UploadKey) => {
    setUploads(prev => {
      if (prev[key].previewUrl) URL.revokeObjectURL(prev[key].previewUrl!)
      return {
        ...prev,
        [key]: { file: null, previewUrl: null, serverUrl: null, uploading: false },
      }
    })
  }, [])

  const submitReturn = useCallback(async () => {
    if (!fields.acceptTerms1 || !fields.acceptTerms2 || !fields.acceptTerms3) {
      setError(tRef.current('error.acceptTerms'))
      return
    }
    if (!signature) {
      setError(tRef.current('error.signature'))
      return
    }

    goToStep('loading')

    await new Promise(resolve => setTimeout(resolve, 3000))

    try {
      const order = selectedOrder!
      let submittedId: string | null = null

      // Try real API first
      try {
        const timeSpent = Math.floor((Date.now() - startTime.current) / 1000)
        const response = await fetch('/api/returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            store_id: order.store_id,
            shopify_order_id: order.shopify_order_id,
            shopify_order_number: order.order_number,
            order_date: order.order_date,
            order_total: order.total,
            order_currency: order.currency,
            customer_email: customerEmail,
            customer_name: fields.fullName,
            customer_phone: fields.customerPhone,
            customer_document: fields.customerDocument,
            form_data: {
              full_name: fields.fullName,
              document: fields.customerDocument,
              phone: fields.customerPhone,
              receive_date: fields.receiveDate,
              reason: fields.returnReason,
              description: fields.returnDescription,
              when_noticed: fields.whenNoticed,
              tried_resolve: fields.triedResolve,
              resolution_attempts: fields.resolutionAttempts,
              product_used: fields.productUsed,
              address: {
                line1: fields.addressLine1,
                line2: fields.addressLine2,
                city: fields.city,
                state: fields.state,
                zip: fields.zipCode,
                country: fields.country,
              },
              resolution_type: fields.resolutionType,
              additional_comments: fields.additionalComments,
              signature,
            },
            attachments: Object.values(uploads).map(u => u.serverUrl).filter(Boolean),
            time_spent_seconds: timeSpent,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error)
        submittedId = data.return_id
      } catch {
        // API not available - insert via REST API com service role key (teste local)
        // TODO: Substituir por Edge Function em produção
        try {
          const reasonLabels: Record<string, string> = {
            defective: 'Produto defeituoso',
            not_as_described: 'Não confere com descrição',
            wrong_item: 'Item errado enviado',
            damaged_shipping: 'Danificado no transporte',
            missing_parts: 'Peças faltando',
            quality_issue: 'Problema de qualidade',
            changed_mind: 'Mudei de ideia',
            other: 'Outro',
          }
          const reasonLabel = reasonLabels[fields.returnReason] || fields.returnReason

          // Usar shop_id do pedido (vem da URL ?shop=UUID)
          const shopId = order.store_id

          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
          const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbGRqYW14ZHNhcXF5dXJjbWNzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3OTA1NywiZXhwIjoyMDg0MDU1MDU3fQ.M3ib-i9Y_YBopQWM5wEkVK2Oi2Ssf511vWgXeUlrfgs'

          const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
            method: 'POST',
            headers: {
              'apikey': SERVICE_KEY,
              'Authorization': `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({
              shop_id: shopId,
              customer_email: customerEmail,
              customer_name: fields.fullName,
              subject: `Devolução ${order.order_number} - ${reasonLabel}`,
              category: 'troca_devolucao_reembolso',
              status: 'pending_human',
              ticket_status: 'pending',
              archived: false,
              shopify_order_id: order.shopify_order_id,
              language: 'pt-BR',
              data_request_count: 0,
              retention_contact_count: 0,
              form_data: {
                full_name: fields.fullName,
                document: fields.customerDocument,
                phone: fields.customerPhone,
                order_number: order.order_number,
                order_date: order.order_date,
                order_total: order.total,
                order_currency: order.currency,
                receive_date: fields.receiveDate,
                line_items: order.line_items,
                reason: fields.returnReason,
                description: fields.returnDescription,
                when_noticed: fields.whenNoticed,
                tried_resolve: fields.triedResolve,
                resolution_attempts: fields.resolutionAttempts,
                product_used: fields.productUsed,
                photos: {
                  product_front: uploads.product_front.serverUrl,
                  product_back: uploads.product_back.serverUrl,
                  defect: uploads.defect.serverUrl,
                  packaging: uploads.packaging.serverUrl,
                  label: uploads.label.serverUrl,
                  id_document: uploads.id_document.serverUrl,
                  proof_of_address: uploads.proof_of_address.serverUrl,
                },
                address: {
                  line1: fields.addressLine1,
                  line2: fields.addressLine2,
                  city: fields.city,
                  state: fields.state,
                  zip: fields.zipCode,
                  country: fields.country,
                },
                resolution_type: fields.resolutionType,
                additional_comments: fields.additionalComments,
                signature,
                time_spent_seconds: Math.floor((Date.now() - startTime.current) / 1000),
                submitted_at: new Date().toISOString(),
              },
            }),
          })

          if (insertRes.ok) {
            const [inserted] = await insertRes.json()
            submittedId = inserted?.id || null
          } else {
            const errBody = await insertRes.text()
            console.warn('Supabase insert falhou:', insertRes.status, errBody)
            throw new Error(tRef.current('error.submitFailed'))
          }
        } catch (supaErr) {
          if (supaErr instanceof Error && supaErr.message === tRef.current('error.submitFailed')) throw supaErr
          console.warn('Fallback Supabase falhou:', supaErr)
          throw new Error(tRef.current('error.connectionError'))
        }
      }

      setReturnId(submittedId)
      sessionStorage.removeItem(STORAGE_KEY)
      goToStep('success')
    } catch (err) {
      console.error('Erro ao submeter:', err)
      setError(tRef.current('error.genericError'))
      goToStep(9)
    }
  }, [fields, signature, selectedOrder, customerEmail, uploads, goToStep])

  return {
    currentStep,
    customerEmail,
    setCustomerEmail,
    orders,
    selectedOrder,
    selectOrder,
    uploads,
    signature,
    setSignature,
    returnId,
    isLoading,
    error,
    setError,
    fields,
    updateField,
    goToStep,
    validateAndNext,
    searchOrders,
    handleFileUpload,
    removeUpload,
    submitReturn,
    locale,
    shopName,
    shopLogoUrl,
  }
}
