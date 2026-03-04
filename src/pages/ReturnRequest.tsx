import { useState } from 'react'
import { Sun, Moon, Shield, Lock, ShieldCheck, Eye } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useReturnForm } from './return-request/useReturnForm'
import { getTranslations, getTermsText } from './return-request/i18n'

import StepEmailLookup from './return-request/StepEmailLookup'
import StepOrderSelection from './return-request/StepOrderSelection'
import StepIdentityVerification from './return-request/StepIdentityVerification'
import StepOrderConfirmation from './return-request/StepOrderConfirmation'
import StepReturnReason from './return-request/StepReturnReason'
import StepProblemDetails from './return-request/StepProblemDetails'
import StepPhotoEvidence from './return-request/StepPhotoEvidence'
import StepAddressConfirmation from './return-request/StepAddressConfirmation'
import StepResolutionPreference from './return-request/StepResolutionPreference'
import StepTermsSignature from './return-request/StepTermsSignature'
import { LoadingScreen, SuccessScreen, OutOfPeriodScreen } from './return-request/StatusScreens'

export default function ReturnRequest() {
  const { theme, setTheme } = useTheme()
  const form = useReturnForm()
  const t = getTranslations(form.locale)
  const termsText = getTermsText(form.locale)

  const storeName = form.shopName || form.selectedOrder?.store_name || form.orders[0]?.store_name || null
  const logoUrl = form.shopLogoUrl || null
  const [logoError, setLogoError] = useState(false)
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  const renderStep = () => {
    switch (form.currentStep) {
      case 0:
        return (
          <StepEmailLookup
            t={t}
            email={form.customerEmail}
            setEmail={form.setCustomerEmail}
            onSearch={form.searchOrders}
            isLoading={form.isLoading}
            error={form.error}
          />
        )
      case 1:
        return (
          <StepOrderSelection
            t={t}
            orders={form.orders}
            selectedOrder={form.selectedOrder}
            onSelect={form.selectOrder}
            onNext={() => form.goToStep(2)}
            onBack={() => form.goToStep(0)}
            error={form.error}
          />
        )
      case 2:
        return (
          <StepIdentityVerification
            t={t}
            fields={form.fields}
            updateField={form.updateField}
            uploads={form.uploads}
            onFileUpload={form.handleFileUpload}
            onRemoveUpload={form.removeUpload}
            onNext={() => form.validateAndNext(2)}
            onBack={() => form.goToStep(1)}
            error={form.error}
          />
        )
      case 3:
        return form.selectedOrder ? (
          <StepOrderConfirmation
            t={t}
            order={form.selectedOrder}
            fields={form.fields}
            updateField={form.updateField}
            onNext={() => form.validateAndNext(3)}
            onBack={() => form.goToStep(2)}
            error={form.error}
          />
        ) : null
      case 4:
        return (
          <StepReturnReason
            t={t}
            fields={form.fields}
            updateField={form.updateField}
            onNext={() => form.validateAndNext(4)}
            onBack={() => form.goToStep(3)}
            error={form.error}
          />
        )
      case 5:
        return (
          <StepProblemDetails
            t={t}
            fields={form.fields}
            updateField={form.updateField}
            onNext={() => form.validateAndNext(5)}
            onBack={() => form.goToStep(4)}
            error={form.error}
          />
        )
      case 6:
        return (
          <StepPhotoEvidence
            t={t}
            uploads={form.uploads}
            onFileUpload={form.handleFileUpload}
            onRemoveUpload={form.removeUpload}
            onNext={() => form.validateAndNext(6)}
            onBack={() => form.goToStep(5)}
            error={form.error}
          />
        )
      case 7:
        return (
          <StepAddressConfirmation
            t={t}
            fields={form.fields}
            updateField={form.updateField}
            uploads={form.uploads}
            onFileUpload={form.handleFileUpload}
            onRemoveUpload={form.removeUpload}
            onNext={() => form.validateAndNext(7)}
            onBack={() => form.goToStep(6)}
            error={form.error}
          />
        )
      case 8:
        return (
          <StepResolutionPreference
            t={t}
            fields={form.fields}
            updateField={form.updateField}
            onNext={() => form.validateAndNext(8)}
            onBack={() => form.goToStep(7)}
            error={form.error}
          />
        )
      case 9:
        return (
          <StepTermsSignature
            t={t}
            termsText={termsText}
            fields={form.fields}
            updateField={form.updateField}
            setSignature={form.setSignature}
            onSubmit={form.submitReturn}
            onBack={() => form.goToStep(8)}
            error={form.error}
          />
        )
      case 'loading':
        return <LoadingScreen t={t} />
      case 'success':
        return <SuccessScreen t={t} returnId={form.returnId} customerEmail={form.customerEmail} />
      case 'out-of-period':
        return <OutOfPeriodScreen t={t} onReset={() => form.goToStep(0)} />
      default:
        return null
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: '32px 20px 24px',
    }}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        title={theme === 'light' ? t('header.darkMode') : t('header.lightMode')}
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* ── Header ── */}
        <div style={{
          marginBottom: '24px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
        }}>
          {/* Gradient top section */}
          <div style={{
            padding: '32px 36px 28px',
            background: 'linear-gradient(135deg, #1a2744 0%, #1e3a5f 40%, #2563eb 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Decorative circles */}
            <div style={{
              position: 'absolute',
              top: '-60%',
              right: '-8%',
              width: '280px',
              height: '280px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '50%',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-40%',
              left: '-5%',
              width: '180px',
              height: '180px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '50%',
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Store avatar */}
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 800,
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  {logoUrl && !logoError ? (
                    <img
                      src={logoUrl}
                      alt={storeName || ''}
                      style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '4px' }}
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    storeName ? storeName.charAt(0).toUpperCase() : 'R'
                  )}
                </div>
                <div>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: '-0.5px',
                    lineHeight: '1.2',
                  }}>
                    {storeName || t('header.returnPortal')}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 500,
                    marginTop: '4px',
                  }}>
                    {t('header.subtitle')}
                  </div>
                </div>
              </div>

              {/* Secure badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '999px',
                color: '#6ee7b7',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}>
                <Shield size={14} />
                {t('header.secure')}
              </div>
            </div>
          </div>

          {/* Trust indicators bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            padding: '12px 24px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Lock size={12} color="#10b981" />
              {t('header.encrypted')}
            </div>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <ShieldCheck size={12} color="#10b981" />
              {t('header.dataProtected')}
            </div>
            <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Eye size={12} color="#10b981" />
              {t('header.officialVerification')}
            </div>
          </div>
        </div>

        {/* ── Main Card ── */}
        <div translate="no" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)',
          padding: '44px 44px 40px',
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
        }}>
          {renderStep()}
        </div>

        {/* ── Footer ── */}
        <div style={{
          textAlign: 'center',
          padding: '16px 20px',
          color: 'var(--text-secondary)',
        }}>
          {/* Trust badges row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              opacity: 0.7,
            }}>
              <Lock size={12} />
              SSL 256-bit
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              opacity: 0.7,
            }}>
              <ShieldCheck size={12} />
              LGPD
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              opacity: 0.7,
            }}>
              <Shield size={12} />
              {t('header.antiFraud')}
            </div>
          </div>

          <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
            {storeName
              ? `© ${new Date().getFullYear()} ${storeName}. ${t('header.allRightsReserved')}`
              : t('header.securePortal')
            }
          </div>
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
            {t('header.infoProtected')}
          </div>
        </div>
      </div>

      {/* Global CSS for form focus states and animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input:focus, select:focus, textarea:focus {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px rgba(70, 114, 236, 0.1) !important;
        }
        input::placeholder, textarea::placeholder {
          color: var(--text-secondary);
          opacity: 0.5;
        }
        button:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        button:active:not(:disabled) {
          transform: translateY(0px);
        }
      `}</style>
    </div>
  )
}
