export type UploadKey =
  | 'product_front'
  | 'product_back'
  | 'defect'
  | 'packaging'
  | 'label'
  | 'id_document'
  | 'proof_of_address'

export interface UploadState {
  file: File | null
  previewUrl: string | null
  serverUrl: string | null
  uploading: boolean
}

export type UploadsMap = Record<UploadKey, UploadState>

export interface LineItem {
  title: string
  quantity: number
  price: string
  image?: string
}

export interface ShippingAddress {
  address1: string
  address2: string
  city: string
  province: string
  zip: string
  country: string
}

export interface Order {
  order_number: string
  order_date: string
  total: string
  currency: string
  line_items: LineItem[]
  customer_name: string
  customer_phone: string
  shipping_address: ShippingAddress | null
  existing_return_status: string | null
  store_id: string
  shopify_order_id: string
  store_name: string
}

export type ReturnStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 'loading' | 'success' | 'out-of-period'

export interface FormFields {
  fullName: string
  customerDocument: string // kept for backward compatibility, no longer collected
  customerPhone: string
  receiveDate: string
  confirmOrder: boolean
  returnReason: string
  returnDescription: string
  whenNoticed: string
  triedResolve: string
  resolutionAttempts: string
  productUsed: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
  confirmAddress: boolean
  resolutionType: string
  additionalComments: string
  acceptTerms1: boolean
  acceptTerms2: boolean
  acceptTerms3: boolean
}

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: () => string
}

export interface StepProps {
  onNext: () => void
  onBack: () => void
}
