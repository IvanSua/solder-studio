import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CartService } from '@core/services/cart.service';
import { OrderService } from '@core/services/order.service';
import { AddressService } from '@core/services/address.service';
import { ProfileService } from '@core/services/profile.service';
import { Cart } from '@core/models/cart.model';
import { Address, AddressRequest } from '@core/models/address.model';
import { LoyaltyCheckoutPreview } from '@core/models/order.model';
import { PricePipe } from '@shared/pipes/price.pipe';
import { environment } from '@env/environment';

type CheckoutStep = 'address' | 'payment';

interface CouponResult {
  valid: boolean;
  message: string;
  discountAmount: number;
  promotionName: string;
}

interface GiftCardResult {
  valid: boolean;
  code: string;
  remainingAmount: number;
  discountApplied: number;
}

interface ShippingOption {
  id: number;
  carrierName: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  priceAmount: number;
  isFree: boolean;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PricePipe],
  template: `
    <div class="checkout-page">

      <!-- Step progress -->
      <div class="steps-bar">
        <a routerLink="/cart" class="back-to-cart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Carrito
        </a>

        <div class="steps">
          <div class="step" [class.active]="step() === 'address'" [class.done]="step() === 'payment'">
            <div class="step-dot">
              @if (step() === 'payment') {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              } @else { 1 }
            </div>
            <span>Dirección</span>
          </div>
          <div class="step-line" [class.filled]="step() === 'payment'"></div>
          <div class="step" [class.active]="step() === 'payment'">
            <div class="step-dot">2</div>
            <span>Pago</span>
          </div>
        </div>
      </div>

      @if (errorMessage()) {
        <div class="alert-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {{ errorMessage() }}
        </div>
      }

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner-lg"></div>
          <span>Cargando checkout...</span>
        </div>
      } @else if (cart() && cart()!.items.length > 0) {
        <div class="checkout-layout">

          <!-- ── LEFT: Steps ─────────────────────────────────────── -->
          <main class="steps-panel">

            <!-- STEP 1: Address -->
            @if (step() === 'address') {
              <div class="step-card">
                <div class="step-card-header">
                  <h2>Dirección de envío</h2>
                </div>

                @if (addresses().length > 0 && !showAddressForm()) {
                  <div class="address-list">
                    @for (addr of addresses(); track addr.id) {
                      <label class="address-card" [class.selected]="selectedAddressId() === addr.id">
                        <input
                          type="radio"
                          name="address"
                          [value]="addr.id"
                          [ngModel]="selectedAddressId()"
                          (ngModelChange)="selectedAddressId.set($event)"
                        />
                        <div class="address-card-body">
                          <div class="address-main-row">
                            <span class="address-street">{{ addr.street }}{{ addr.apartment ? ', ' + addr.apartment : '' }}</span>
                            @if (addr.defaultAddress) {
                              <span class="badge-default">Predeterminada</span>
                            }
                          </div>
                          <span class="address-sub">{{ addr.city }}, {{ addr.province }} {{ addr.postalCode }}</span>
                          @if (addr.notes) {
                            <span class="address-notes">{{ addr.notes }}</span>
                          }
                        </div>
                      </label>
                    }
                  </div>

                  <button class="btn-link-add" (click)="showAddressForm.set(true)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar nueva dirección
                  </button>

                  <button
                    class="btn-primary"
                    (click)="goToPayment()"
                    [disabled]="!selectedAddressId()">
                    Continuar al pago
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                }

                @if (showAddressForm() || addresses().length === 0) {
                  <form class="address-form" (ngSubmit)="saveAddress()" #addrForm="ngForm">
                    @if (addresses().length > 0) {
                      <h3>Nueva dirección</h3>
                    }

                    <div class="form-group" [class.has-error]="submitted() && !newAddress.street.trim()">
                      <label for="street">Calle y número <span class="required">*</span></label>
                      <input
                        id="street"
                        type="text"
                        [(ngModel)]="newAddress.street"
                        name="street"
                        placeholder="Ej: Av. Corrientes 1234"
                        autocomplete="street-address" />
                      @if (submitted() && !newAddress.street.trim()) {
                        <span class="field-error">Este campo es requerido</span>
                      }
                    </div>

                    <div class="form-group">
                      <label for="apartment">Piso / Dpto</label>
                      <input
                        id="apartment"
                        type="text"
                        [(ngModel)]="newAddress.apartment"
                        name="apartment"
                        placeholder="Ej: 3B (opcional)"
                        autocomplete="address-line2" />
                    </div>

                    <div class="form-row">
                      <div class="form-group" [class.has-error]="submitted() && !newAddress.city.trim()">
                        <label for="city">Ciudad <span class="required">*</span></label>
                        <input
                          id="city"
                          type="text"
                          [(ngModel)]="newAddress.city"
                          name="city"
                          placeholder="Ej: Buenos Aires"
                          autocomplete="address-level2" />
                        @if (submitted() && !newAddress.city.trim()) {
                          <span class="field-error">Requerido</span>
                        }
                      </div>
                      <div class="form-group" [class.has-error]="submitted() && !newAddress.province.trim()">
                        <label for="province">Provincia <span class="required">*</span></label>
                        <input
                          id="province"
                          type="text"
                          [(ngModel)]="newAddress.province"
                          name="province"
                          placeholder="Ej: CABA"
                          autocomplete="address-level1" />
                        @if (submitted() && !newAddress.province.trim()) {
                          <span class="field-error">Requerido</span>
                        }
                      </div>
                    </div>

                    <div class="form-group" [class.has-error]="submitted() && !newAddress.postalCode.trim()">
                      <label for="postalCode">Código postal <span class="required">*</span></label>
                      <input
                        id="postalCode"
                        type="text"
                        [(ngModel)]="newAddress.postalCode"
                        name="postalCode"
                        placeholder="Ej: 1043"
                        autocomplete="postal-code"
                        style="max-width: 180px" />
                      @if (submitted() && !newAddress.postalCode.trim()) {
                        <span class="field-error">Requerido</span>
                      }
                    </div>

                    <div class="form-group">
                      <label for="notes">Instrucciones de entrega</label>
                      <input
                        id="notes"
                        type="text"
                        [(ngModel)]="newAddress.notes"
                        name="notes"
                        placeholder="Ej: Timbre 3B, portero eléctrico (opcional)" />
                    </div>

                    <label class="checkbox-label" for="defaultAddress">
                      <input id="defaultAddress" type="checkbox" [(ngModel)]="newAddress.defaultAddress" name="defaultAddress" />
                      Establecer como predeterminada
                    </label>

                    <div class="form-actions">
                      @if (addresses().length > 0) {
                        <button type="button" class="btn-secondary" (click)="cancelAddressForm()">
                          Cancelar
                        </button>
                      }
                      <button
                        type="submit"
                        class="btn-primary"
                        [disabled]="savingAddress()">
                        @if (savingAddress()) {
                          <span class="spinner-sm"></span>
                          Guardando...
                        } @else {
                          Guardar y continuar
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        }
                      </button>
                    </div>
                  </form>
                }
              </div>
            }

            <!-- STEP 2: Payment -->
            @if (step() === 'payment') {
              <div class="step-card">
                <div class="step-card-header">
                  <h2>Confirmar y pagar</h2>
                </div>

                <!-- Selected address summary -->
                @if (selectedAddress(); as addr) {
                  <div class="confirmed-address">
                    <div class="confirmed-address-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <div class="confirmed-address-text">
                      <span class="confirmed-label">Enviando a:</span>
                      <span>{{ addr.street }}{{ addr.apartment ? ', ' + addr.apartment : '' }}, {{ addr.city }}, {{ addr.province }}</span>
                    </div>
                    <button class="btn-change" (click)="step.set('address')">Cambiar</button>
                  </div>
                }

                <!-- Shipping options -->
                <div class="shipping-section">
                  <h3>Método de envío</h3>
                  @if (loadingShipping()) {
                    <div class="shipping-loading">
                      <span class="spinner-sm"></span> Calculando opciones de envío...
                    </div>
                  } @else if (shippingOptions().length === 0) {
                    <p class="shipping-unavailable">No hay tarifas disponibles para tu provincia. El envío se coordinará por separado.</p>
                  } @else {
                    <div class="shipping-options">
                      @for (option of shippingOptions(); track option.id) {
                        <div class="shipping-option"
                             [class.selected]="selectedShippingRateId() === option.id"
                             (click)="selectedShippingRateId.set(option.id)">
                          <div class="shipping-option-radio">
                            <div class="radio-dot" [class.active]="selectedShippingRateId() === option.id"></div>
                          </div>
                          <div class="shipping-option-info">
                            <span class="shipping-carrier">{{ option.carrierName }}</span>
                            <span class="shipping-days">{{ option.deliveryDaysMin }}–{{ option.deliveryDaysMax }} días hábiles</span>
                          </div>
                          <span class="shipping-price" [class.free]="option.isFree">
                            {{ option.isFree ? 'Gratis' : (option.priceAmount | price: cart()!.currencyCode) }}
                          </span>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Coupon code -->
                <div class="coupon-section">
                  <h3>¿Tenés un cupón?</h3>
                  <div class="coupon-row">
                    <input
                      type="text"
                      class="coupon-input"
                      [(ngModel)]="couponCode"
                      placeholder="Ej: VERANO20"
                      [disabled]="couponApplied() !== null"
                      (keyup.enter)="validateCoupon()"
                      style="text-transform: uppercase;"
                    />
                    @if (!couponApplied()) {
                      <button class="btn-coupon" (click)="validateCoupon()" [disabled]="!couponCode.trim() || validatingCoupon()">
                        @if (validatingCoupon()) { <span class="spinner-sm"></span> } @else { Aplicar }
                      </button>
                    } @else {
                      <button class="btn-coupon remove" (click)="removeCoupon()">Quitar</button>
                    }
                  </div>
                  @if (couponError()) {
                    <span class="coupon-error">{{ couponError() }}</span>
                  }
                  @if (couponApplied()) {
                    <div class="coupon-applied">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>{{ couponApplied()!.promotionName }} — descuento de {{ couponApplied()!.discountAmount | price: cart()!.currencyCode }}</span>
                    </div>
                  }
                </div>

                <!-- Gift Card code -->
                <div class="coupon-section gift-card-section">
                  <h3>¿Tenés una Gift Card? 🎁</h3>
                  <div class="coupon-row">
                    <input
                      type="text"
                      class="coupon-input"
                      [(ngModel)]="giftCardCode"
                      placeholder="Código de Gift Card"
                      [disabled]="giftCardApplied() !== null"
                      (keyup.enter)="validateGiftCard()"
                      style="text-transform: uppercase;"
                    />
                    @if (!giftCardApplied()) {
                      <button class="btn-coupon btn-gift-card" (click)="validateGiftCard()" [disabled]="!giftCardCode.trim() || validatingGiftCard()">
                        @if (validatingGiftCard()) { <span class="spinner-sm"></span> } @else { Usar }
                      </button>
                    } @else {
                      <button class="btn-coupon remove" (click)="removeGiftCard()">Quitar</button>
                    }
                  </div>
                  @if (giftCardError()) {
                    <span class="coupon-error">{{ giftCardError() }}</span>
                  }
                  @if (giftCardApplied()) {
                    <div class="coupon-applied gift-card-applied">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>{{ giftCardApplied()!.code }} — descuento de {{ giftCardApplied()!.discountApplied | price: cart()!.currencyCode }}</span>
                    </div>
                  }
                </div>

                <!-- Loyalty / Points -->
                @if (loyaltyPreview(); as lp) {
                  <div class="coupon-section loyalty-section">
                    <h3>
                      <span class="loyalty-badge" [attr.data-level]="lp.level">{{ lp.levelLabel }}</span>
                      Mis puntos de lealtad
                    </h3>

                    @if (lp.tierDiscountPercent > 0) {
                      <div class="loyalty-tier-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        Beneficio {{ lp.levelLabel }}: {{ lp.tierDiscountPercent }}% de descuento aplicado automáticamente
                      </div>
                    }

                    <div class="loyalty-points-info">
                      <span class="points-balance">{{ lp.availablePoints | number }} puntos disponibles</span>
                      @if (lp.maxRedeemablePoints > 0) {
                        <span class="points-max">(máx. {{ lp.maxRedeemablePoints | number }} canjeables en esta compra)</span>
                      }
                    </div>

                    @if (lp.maxRedeemablePoints >= 100) {
                      @if (pointsToRedeem() === 0) {
                        <button class="btn-coupon btn-loyalty" (click)="setPointsToRedeem(lp.maxRedeemablePoints)">
                          Usar {{ lp.maxRedeemablePoints | number }} puntos
                          (−{{ lp.maxRedeemablePoints * 100 | price: 'ARS' }})
                        </button>
                      } @else {
                        <div class="coupon-applied loyalty-applied">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span>{{ pointsToRedeem() | number }} puntos canjeados — descuento de {{ lp.pointsDiscountAmount | price: 'ARS' }}</span>
                        </div>
                        <button class="btn-coupon remove" (click)="clearLoyaltyPoints()">Quitar</button>
                      }
                    } @else if (lp.availablePoints > 0 && lp.maxRedeemablePoints === 0) {
                      <p class="loyalty-hint">Tus puntos no alcanzan el mínimo canjeable para este pedido.</p>
                    } @else if (lp.availablePoints === 0) {
                      <p class="loyalty-hint">Completá tu primera compra para empezar a acumular puntos.</p>
                    }
                  </div>
                }

                <!-- Payment method -->
                <div class="payment-method-section">
                  <h3>Método de pago</h3>

                  <!-- MercadoPago -->
                  <div class="payment-option" [class.selected]="paymentMethod() === 'MERCADOPAGO'"
                       (click)="paymentMethod.set('MERCADOPAGO')">
                    <div class="payment-option-left">
                      <div class="payment-icon-box">
                        <span style="color:#009ee3;font-weight:800;font-size:1rem;">MP</span>
                      </div>
                      <div>
                        <span class="payment-name">MercadoPago</span>
                        <span class="payment-desc">Tarjeta de crédito / débito · Cuotas sin interés</span>
                      </div>
                    </div>
                    @if (paymentMethod() === 'MERCADOPAGO') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#009ee3" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </div>

                  <!-- Transferencia bancaria -->
                  <div class="payment-option" [class.selected]="paymentMethod() === 'TRANSFER'"
                       (click)="paymentMethod.set('TRANSFER')">
                    <div class="payment-option-left">
                      <div class="payment-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                      </div>
                      <div>
                        <span class="payment-name">Transferencia bancaria</span>
                        <span class="payment-desc">CBU / Alias · Confirmación manual en 1-2 hs</span>
                      </div>
                    </div>
                    @if (paymentMethod() === 'TRANSFER') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </div>

                  <!-- Efectivo -->
                  <div class="payment-option" [class.selected]="paymentMethod() === 'CASH'"
                       (click)="paymentMethod.set('CASH')">
                    <div class="payment-option-left">
                      <div class="payment-icon-box">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      </div>
                      <div>
                        <span class="payment-name">Efectivo</span>
                        <span class="payment-desc">Pagás al retirar o recibir el pedido</span>
                      </div>
                    </div>
                    @if (paymentMethod() === 'CASH') {
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>
                    }
                  </div>

                  <!-- Cuotas — solo para MercadoPago -->
                  @if (paymentMethod() === 'MERCADOPAGO') {
                    <div class="installments-section">
                      <label class="installments-label" for="installments">Cuotas</label>
                      <select id="installments" class="installments-select"
                              [ngModel]="installments()"
                              (ngModelChange)="installments.set($event)">
                        <option [value]="1">1 cuota (sin interés)</option>
                        <option [value]="3">3 cuotas sin interés</option>
                        <option [value]="6">6 cuotas sin interés</option>
                        <option [value]="12">12 cuotas sin interés</option>
                      </select>
                    </div>
                  }

                  @if (paymentMethod() === 'TRANSFER') {
                    <div class="transfer-info">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Recibirás los datos bancarios por email tras confirmar el pedido.
                    </div>
                  }
                </div>

                <!-- Total confirm -->
                @if (couponApplied() || giftCardApplied()) {
                  <div class="payment-discount-row">
                    <span>Subtotal</span>
                    <span>{{ cart()!.totalAmount | price: cart()!.currencyCode }}</span>
                  </div>
                }
                @if (couponApplied()) {
                  <div class="payment-discount-row green">
                    <span>Descuento ({{ couponApplied()!.promotionName }})</span>
                    <span>-{{ couponApplied()!.discountAmount | price: cart()!.currencyCode }}</span>
                  </div>
                }
                @if (giftCardApplied()) {
                  <div class="payment-discount-row purple">
                    <span>Gift Card ({{ giftCardApplied()!.code }})</span>
                    <span>-{{ giftCardApplied()!.discountApplied | price: cart()!.currencyCode }}</span>
                  </div>
                }
                <div class="payment-total-row">
                  <span>Total a pagar</span>
                  <span class="total-big">{{ effectiveTotal() | price: cart()!.currencyCode }}</span>
                </div>

                @if (paymentMethod() === 'MERCADOPAGO') {
                  <button
                    class="btn-pay btn-mercadopago"
                    (click)="startCheckout()"
                    [disabled]="processing()">
                    @if (processing()) {
                      <span class="spinner-sm white"></span>
                      Redirigiendo a MercadoPago...
                    } @else {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Pagar con MercadoPago
                    }
                  </button>
                } @else {
                  <button
                    class="btn-pay btn-confirm"
                    (click)="startCheckout()"
                    [disabled]="processing()">
                    @if (processing()) {
                      <span class="spinner-sm white"></span>
                      Procesando...
                    } @else {
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      Confirmar pedido
                    }
                  </button>
                }

                <p class="secure-note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Tu información está protegida con cifrado SSL
                </p>
              </div>
            }
          </main>

          <!-- ── RIGHT: Order summary ─────────────────────────────── -->
          <aside class="summary-panel">
            <h2 class="summary-heading">Tu pedido</h2>

            <div class="summary-items">
              @for (item of cart()!.items; track item.cartItemId) {
                <div class="summary-item">
                  <div class="summary-item-thumb">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" [alt]="item.productName" loading="lazy" />
                    } @else {
                      <div class="thumb-placeholder">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      </div>
                    }
                    <span class="qty-badge">{{ item.quantity }}</span>
                  </div>
                  <div class="summary-item-info">
                    <span class="si-name">{{ item.productName }}</span>
                    <span class="si-variant">{{ item.color }} / {{ item.size }}</span>
                    @if (item.customDesignId) {
                      <span class="si-custom">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Personalizado
                      </span>
                    }
                  </div>
                  <span class="si-price">{{ item.unitPrice * item.quantity | price: item.currencyCode }}</span>
                </div>
              }
            </div>

            <div class="summary-divider"></div>

            <div class="summary-totals">
              <div class="st-row">
                <span>Subtotal</span>
                <span>{{ cart()!.totalAmount | price: cart()!.currencyCode }}</span>
              </div>
              @if (couponApplied()) {
                <div class="st-row discount-row">
                  <span>Descuento ({{ couponApplied()!.promotionName }})</span>
                  <span class="discount-amount">-{{ couponApplied()!.discountAmount | price: cart()!.currencyCode }}</span>
                </div>
              }
              @if (loyaltyPreview(); as lp) {
                @if (lp.tierDiscountPercent > 0) {
                  <div class="st-row discount-row loyalty-tier-row">
                    <span>Descuento {{ lp.levelLabel }} ({{ lp.tierDiscountPercent }}%)</span>
                    <span class="discount-amount">-{{ lp.tierDiscountAmount | price: cart()!.currencyCode }}</span>
                  </div>
                }
                @if (lp.pointsRedeemed > 0) {
                  <div class="st-row discount-row loyalty-points-row">
                    <span>Puntos canjeados ({{ lp.pointsRedeemed | number }} pts)</span>
                    <span class="discount-amount">-{{ lp.pointsDiscountAmount | price: cart()!.currencyCode }}</span>
                  </div>
                }
              }
              @if (giftCardApplied()) {
                <div class="st-row discount-row">
                  <span>Gift Card</span>
                  <span class="discount-amount">-{{ giftCardApplied()!.discountApplied | price: cart()!.currencyCode }}</span>
                </div>
              }
              <div class="st-row">
                <span>Envío</span>
                @if (selectedShipping(); as s) {
                  <span [class.free-shipping]="s.isFree">{{ s.isFree ? 'Gratis' : (s.priceAmount | price: cart()!.currencyCode) }}</span>
                } @else {
                  <span class="shipping-tbd">A calcular</span>
                }
              </div>
              <div class="st-row delivery-row">
                <span>Entrega estimada</span>
                <span class="delivery-estimate">{{ estimatedDelivery() }}</span>
              </div>
            </div>

            <div class="summary-divider"></div>

            <div class="summary-grand-total">
              <span>Total</span>
              <span>{{ effectiveTotal() | price: cart()!.currencyCode }}</span>
            </div>
          </aside>

        </div>
      } @else if (!loading()) {
        <div class="empty-state">
          <p>Tu carrito está vacío.</p>
          <a routerLink="/" class="btn-primary">Ir al catálogo</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .checkout-page {
      max-width: 1000px;
      margin: 0 auto;
      padding: 1.5rem 1.5rem 3rem;
    }

    /* Steps bar */
    .steps-bar {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .back-to-cart {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      text-decoration: none;
      transition: color 0.15s;
      white-space: nowrap;
    }
    .back-to-cart:hover { color: var(--primary); }
    .steps {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .step.active { color: var(--text); font-weight: 600; }
    .step.done { color: var(--success-text); }
    .step-dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      background: var(--bg-card);
      flex-shrink: 0;
    }
    .step.active .step-dot {
      border-color: var(--primary);
      background: var(--primary);
      color: white;
    }
    .step.done .step-dot {
      border-color: var(--success);
      background: var(--success);
      color: white;
    }
    .step-line {
      flex: 1;
      height: 2px;
      background: var(--border);
      border-radius: 1px;
      max-width: 80px;
      transition: background 0.3s;
    }
    .step-line.filled { background: var(--success); }

    /* Alert */
    .alert-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
    }

    /* Loading */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 4rem;
      color: var(--text-muted);
    }
    .spinner-lg {
      width: 36px;
      height: 36px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .spinner-sm {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    .spinner-sm.white { border-top-color: white; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Layout */
    .checkout-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 2rem;
      align-items: start;
    }

    /* Step card */
    .step-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
    }
    .step-card-header { margin-bottom: 1.5rem; }
    .step-card-header h2 {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0;
    }

    /* Address list */
    .address-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
    .address-card {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      border: 2px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .address-card:hover { border-color: var(--primary); }
    .address-card.selected {
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .address-card input[type="radio"] {
      margin-top: 3px;
      accent-color: var(--primary);
      flex-shrink: 0;
    }
    .address-card-body { display: flex; flex-direction: column; gap: 3px; }
    .address-main-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .address-street { font-weight: 600; }
    .badge-default {
      background: var(--success-bg);
      color: var(--success-text);
      font-size: 0.7rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .address-sub { font-size: 0.85rem; color: var(--text-muted); }
    .address-notes { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }

    .btn-link-add {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: none;
      border: none;
      color: var(--primary);
      font-size: 0.875rem;
      cursor: pointer;
      padding: 0.25rem 0;
      margin-bottom: 1.25rem;
    }
    .btn-link-add:hover { text-decoration: underline; }

    /* Address form */
    .address-form { display: flex; flex-direction: column; gap: 1rem; }
    .address-form h3 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-group label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
    }
    .required { color: var(--danger); }
    .form-group input {
      padding: 0.625rem 0.875rem;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-size: 0.9rem;
      transition: border-color 0.15s;
      outline: none;
    }
    .form-group input:focus { border-color: var(--primary); }
    .has-error input { border-color: var(--danger); }
    .field-error {
      font-size: 0.775rem;
      color: var(--danger);
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .form-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      padding-top: 0.25rem;
    }

    /* Confirmed address */
    .confirmed-address {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      border-radius: 10px;
      padding: 0.875rem 1rem;
      margin-bottom: 1.5rem;
    }
    .confirmed-address-icon {
      color: var(--success-text);
      flex-shrink: 0;
    }
    .confirmed-address-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.875rem;
    }
    .confirmed-label { font-weight: 600; font-size: 0.775rem; color: var(--success-text); text-transform: uppercase; letter-spacing: 0.04em; }
    .btn-change {
      background: none;
      border: none;
      color: var(--primary);
      font-size: 0.825rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-change:hover { text-decoration: underline; }

    /* Payment section */
    .payment-method-section { margin-bottom: 1.5rem; }
    .payment-method-section h3 {
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    .payment-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 2px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
    }
    .payment-option.selected {
      border-color: var(--primary);
      background: var(--primary-light);
    }
    .payment-option-left { display: flex; align-items: center; gap: 0.875rem; }
    .payment-icon-box {
      width: 44px;
      height: 44px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .payment-name { display: block; font-weight: 600; font-size: 0.9375rem; }
    .payment-desc { display: block; font-size: 0.775rem; color: var(--text-muted); }

    /* Installments */
    .installments-section {
      margin-top: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .installments-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
    }
    .installments-select {
      flex: 1;
      max-width: 260px;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      outline: none;
      cursor: pointer;
      background: var(--bg-card);
    }
    .installments-select:focus { border-color: var(--primary); }

    /* Transfer info banner */
    .transfer-info {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-top: 0.875rem;
      padding: 0.75rem;
      background: var(--warning-bg);
      border: 1px solid var(--warning-border);
      border-radius: 8px;
      font-size: 0.8125rem;
      color: var(--warning-text);
      line-height: 1.4;
    }

    /* Shipping section */
    .shipping-section { margin-top: 1.5rem; }
    .shipping-section h3 { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--text); }
    .shipping-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.875rem; }
    .shipping-unavailable { font-size: 0.875rem; color: var(--text-muted); font-style: italic; }
    .shipping-options { display: flex; flex-direction: column; gap: 0.5rem; }
    .shipping-option {
      display: flex; align-items: center; gap: 0.75rem;
      border: 1.5px solid var(--border); border-radius: 8px;
      padding: 0.75rem 1rem; cursor: pointer; transition: border-color 0.15s;
    }
    .shipping-option:hover { border-color: var(--info-border); }
    .shipping-option.selected { border-color: var(--primary); background: var(--primary-light); }
    .shipping-option-radio { flex-shrink: 0; }
    .radio-dot {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid var(--border); display: flex; align-items: center; justify-content: center;
      transition: border-color 0.15s;
    }
    .radio-dot.active { border-color: var(--primary); }
    .radio-dot.active::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
    .shipping-option-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .shipping-carrier { font-weight: 600; font-size: 0.875rem; }
    .shipping-days { font-size: 0.775rem; color: var(--text-muted); }
    .shipping-price { font-weight: 700; font-size: 0.9rem; white-space: nowrap; }
    .shipping-price.free { color: var(--success-text); }
    .free-shipping { color: var(--success-text); font-weight: 600; }

    /* Coupon section */
    .coupon-section { margin-top: 1.5rem; }
    .coupon-section h3 {
      font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.75rem; color: var(--text);
    }
    .gift-card-section { border-top: 1px dashed var(--border); padding-top: 1.5rem; margin-top: 1.5rem; }
    .btn-gift-card { background: var(--info); }
    .btn-gift-card:hover:not(:disabled) { background: var(--info-text); opacity: 1; }
    .gift-card-applied { color: var(--info-text); }

    /* Loyalty section */
    .loyalty-section { border-top: 1px solid var(--border); }
    .loyalty-badge {
      display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px;
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; margin-right: 0.4rem; vertical-align: middle;
    }
    .loyalty-badge[data-level="BRONZE"]   { background: var(--warning-bg);  color: var(--warning-text); }
    .loyalty-badge[data-level="SILVER"]   { background: var(--bg-secondary); color: var(--text-secondary); }
    .loyalty-badge[data-level="GOLD"]     { background: var(--warning-bg);  color: var(--warning-text); }
    .loyalty-badge[data-level="PLATINUM"] { background: var(--info-bg);     color: var(--info-text); }
    .loyalty-tier-badge {
      display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem;
      color: var(--warning-text); background: var(--warning-bg); border: 1px solid var(--warning-border);
      border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem;
    }
    .loyalty-points-info { font-size: 0.85rem; color: var(--text); margin-bottom: 0.75rem; }
    .points-balance { font-weight: 600; }
    .points-max { color: var(--text-secondary); margin-left: 0.3rem; }
    .btn-loyalty { background: var(--info-text); }
    .btn-loyalty:hover:not(:disabled) { background: var(--info-text); opacity: 1; }
    .loyalty-applied { color: var(--info-text); }
    .loyalty-hint { font-size: 0.8rem; color: var(--text-secondary); margin: 0; }
    .loyalty-tier-row .discount-amount { color: var(--warning-text); }
    .loyalty-points-row .discount-amount { color: var(--info-text); }
    .coupon-row { display: flex; gap: 0.5rem; }
    .coupon-input {
      flex: 1; padding: 0.6rem 0.875rem; border: 1px solid var(--border);
      border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.15s;
      letter-spacing: 0.05em; font-weight: 600;
    }
    .coupon-input:focus { border-color: var(--primary); }
    .coupon-input:disabled { background: var(--bg-secondary); color: var(--text-secondary); }
    .btn-coupon {
      padding: 0.6rem 1.25rem; background: var(--primary); color: white;
      border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
      cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.35rem;
      transition: opacity 0.15s;
    }
    .btn-coupon:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-coupon:not(:disabled):hover { opacity: 0.9; }
    .btn-coupon.remove { background: var(--text-muted); }
    .btn-coupon.remove:hover { background: var(--text-secondary); opacity: 1; }
    .coupon-error { font-size: 0.8rem; color: var(--danger); margin-top: 0.35rem; display: block; }
    .coupon-applied {
      display: flex; align-items: center; gap: 0.4rem; margin-top: 0.5rem;
      font-size: 0.82rem; color: var(--success-text); font-weight: 600;
    }

    .payment-discount-row {
      display: flex; justify-content: space-between; padding: 0.3rem 0;
      font-size: 0.875rem; color: var(--text-muted);
    }
    .payment-discount-row.green { color: var(--success-text); font-weight: 600; }
    .payment-discount-row.purple { color: var(--info-text); font-weight: 600; }

    .discount-row { color: var(--success-text); }
    .discount-amount { font-weight: 600; }

    .payment-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 0;
      border-top: 1px solid var(--border);
      margin-top: 0.5rem;
      font-weight: 600;
    }
    .total-big { font-size: 1.4rem; font-weight: 800; color: var(--text); }

    .secure-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.875rem;
    }

    /* Buttons */
    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 10px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }

    .btn-secondary {
      padding: 0.875rem 1.5rem;
      background: var(--bg-card);
      color: var(--text);
      border: 1.5px solid var(--border);
      border-radius: 10px;
      font-weight: 500;
      font-size: 0.95rem;
      cursor: pointer;
    }
    .btn-secondary:hover { background: var(--bg-secondary); }

    .btn-pay {
      width: 100%;
      padding: 1rem;
      color: white;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 1.05rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s;
      margin-top: 0.25rem;
    }
    .btn-pay:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-mercadopago { background: #009ee3; }
    .btn-mercadopago:hover:not(:disabled) { background: #007cbf; }
    .btn-confirm { background: var(--success); }
    .btn-confirm:hover:not(:disabled) { background: var(--success-text); }

    /* Summary panel */
    .summary-panel {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      position: sticky;
      top: 1.5rem;
    }
    .summary-heading {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 1.25rem;
    }
    .summary-items { display: flex; flex-direction: column; gap: 1rem; }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }
    .summary-item-thumb {
      position: relative;
      flex-shrink: 0;
    }
    .summary-item-thumb img {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: 8px;
      display: block;
    }
    .thumb-placeholder {
      width: 56px;
      height: 56px;
      background: var(--border);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
    }
    .qty-badge {
      position: absolute;
      top: -6px;
      right: -6px;
      background: var(--text);
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
    }
    .summary-item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .si-name {
      font-weight: 600;
      font-size: 0.875rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .si-variant { font-size: 0.775rem; color: var(--text-muted); }
    .si-custom {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 0.7rem;
      color: var(--info);
      font-weight: 600;
    }
    .si-price { font-weight: 700; font-size: 0.875rem; white-space: nowrap; }

    .summary-divider { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }
    .summary-totals { display: flex; flex-direction: column; gap: 0.5rem; }
    .st-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      color: var(--text-muted);
    }
    .shipping-tbd { font-style: italic; }
    .delivery-row .delivery-estimate { color: var(--success-text); font-weight: 600; font-size: 0.85rem; }
    .summary-grand-total {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: 1.0625rem;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 4rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    /* Responsive */
    @media (max-width: 700px) {
      .checkout-layout { grid-template-columns: 1fr; }
      .summary-panel { position: static; order: -1; }
      .form-row { grid-template-columns: 1fr; }
      .steps-bar { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class CheckoutComponent implements OnInit {
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private addressService = inject(AddressService);
  private profileService = inject(ProfileService);
  private http = inject(HttpClient);

  cart = signal<Cart | null>(null);
  addresses = signal<Address[]>([]);
  selectedAddressId = signal<number | null>(null);

  step = signal<CheckoutStep>('address');
  loading = signal(true);
  processing = signal(false);
  savingAddress = signal(false);
  showAddressForm = signal(false);
  submitted = signal(false);
  errorMessage = signal('');

  // Coupon state
  couponCode = '';
  validatingCoupon = signal(false);
  couponApplied = signal<CouponResult | null>(null);
  couponError = signal('');

  // Gift card state
  giftCardCode = '';
  validatingGiftCard = signal(false);
  giftCardApplied = signal<GiftCardResult | null>(null);
  giftCardError = signal('');

  // Loyalty state
  loyaltyPreview = signal<LoyaltyCheckoutPreview | null>(null);
  pointsToRedeem = signal(0);
  loadingLoyalty = signal(false);

  // Shipping state
  shippingOptions = signal<ShippingOption[]>([]);
  selectedShippingRateId = signal<number | null>(null);
  loadingShipping = signal(false);

  selectedShipping = computed(() =>
    this.shippingOptions().find(o => o.id === this.selectedShippingRateId()) ?? null
  );

  // Payment state
  paymentMethod = signal<'MERCADOPAGO' | 'TRANSFER' | 'CASH'>('MERCADOPAGO');
  installments = signal<number>(1);

  newAddress: AddressRequest = {
    street: '',
    apartment: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
    defaultAddress: false,
  };

  selectedAddress = computed(() =>
    this.addresses().find(a => a.id === this.selectedAddressId())
  );

  /** Estimated delivery based on selected shipping option, or 5–7 business days as fallback */
  estimatedDelivery = computed(() => {
    const addBusinessDays = (date: Date, days: number): Date => {
      const d = new Date(date);
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) added++; // skip weekends
      }
      return d;
    };
    const shipping = this.selectedShipping();
    const daysMin = shipping?.deliveryDaysMin ?? 5;
    const daysMax = shipping?.deliveryDaysMax ?? 7;
    const today = new Date();
    const from = addBusinessDays(today, daysMin);
    const to   = addBusinessDays(today, daysMax);
    const fmt = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    return `${fmt(from)} – ${fmt(to)}`;
  });

  effectiveTotal = computed(() => {
    const c = this.cart();
    if (!c) return 0;
    const couponDiscount   = this.couponApplied()?.discountAmount ?? 0;
    const giftCardDiscount = this.giftCardApplied()?.discountApplied ?? 0;
    const preview          = this.loyaltyPreview();
    const tierDiscount     = preview?.tierDiscountAmount ?? 0;
    const pointsDiscount   = preview?.pointsDiscountAmount ?? 0;
    const shippingAmount   = this.selectedShipping()?.isFree ? 0 : (this.selectedShipping()?.priceAmount ?? 0);
    return Math.max(0, c.totalAmount - couponDiscount - tierDiscount - pointsDiscount - giftCardDiscount) + shippingAmount;
  });

  ngOnInit(): void {
    this.cartService.loadCart().subscribe(cart => {
      this.cart.set(cart);
      this.loadAddresses();
      this.loadLoyaltyPreview();
    });
  }

  loadLoyaltyPreview(pts = 0): void {
    const c = this.cart();
    if (!c) return;
    const couponDiscount = this.couponApplied()?.discountAmount ?? 0;
    const subtotal = Math.max(0, c.totalAmount - couponDiscount);
    this.loadingLoyalty.set(true);
    this.http.get<LoyaltyCheckoutPreview>(
      `${environment.apiUrl}/checkout/loyalty-preview`,
      { params: new HttpParams().set('subtotal', subtotal).set('pointsToRedeem', pts) }
    ).subscribe({
      next: preview => { this.loyaltyPreview.set(preview); this.loadingLoyalty.set(false); },
      error: ()     => { this.loadingLoyalty.set(false); },
    });
  }

  setPointsToRedeem(pts: number): void {
    const preview = this.loyaltyPreview();
    const clamped = Math.min(pts, preview?.maxRedeemablePoints ?? 0);
    this.pointsToRedeem.set(clamped);
    this.loadLoyaltyPreview(clamped);
  }

  clearLoyaltyPoints(): void {
    this.pointsToRedeem.set(0);
    this.loadLoyaltyPreview(0);
  }

  private loadAddresses(): void {
    this.addressService.getAddresses().subscribe({
      next: addresses => {
        this.addresses.set(addresses);
        const def = addresses.find(a => a.defaultAddress);
        this.selectedAddressId.set(def?.id ?? addresses[0]?.id ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isAddressFormValid(): boolean {
    const a = this.newAddress;
    return !!(a.street?.trim() && a.city?.trim() && a.province?.trim() && a.postalCode?.trim());
  }

  goToPayment(): void {
    const addr = this.selectedAddress();
    if (!addr) return;

    this.step.set('payment');
    this.loadingShipping.set(true);
    this.shippingOptions.set([]);
    this.selectedShippingRateId.set(null);

    const subtotal = this.cart()?.totalAmount ?? 0;
    const params = new HttpParams()
      .set('province', addr.province)
      .set('orderAmount', subtotal);

    this.http.get<ShippingOption[]>(`${environment.apiUrl}/shipping/calculate`, { params })
      .subscribe({
        next: options => {
          const opts = options ?? [];
          this.shippingOptions.set(opts);
          if (opts.length > 0) {
            this.selectedShippingRateId.set(opts[0].id);
          }
          this.loadingShipping.set(false);
        },
        error: () => this.loadingShipping.set(false),
      });
  }

  cancelAddressForm(): void {
    this.showAddressForm.set(false);
    this.submitted.set(false);
    this.resetNewAddressForm();
  }

  saveAddress(): void {
    this.submitted.set(true);
    if (!this.isAddressFormValid()) return;

    this.savingAddress.set(true);
    this.errorMessage.set('');

    this.addressService.createAddress(this.newAddress).subscribe({
      next: saved => {
        this.addresses.update(list => [...list, saved]);
        this.selectedAddressId.set(saved.id);
        this.showAddressForm.set(false);
        this.submitted.set(false);
        this.savingAddress.set(false);
        this.resetNewAddressForm();
        this.step.set('payment');
      },
      error: err => {
        this.savingAddress.set(false);
        this.errorMessage.set(err.error?.error || 'No se pudo guardar la dirección');
      },
    });
  }

  validateCoupon(): void {
    const code = this.couponCode.trim().toUpperCase();
    if (!code) return;
    const subtotal = this.cart()?.totalAmount ?? 0;

    this.validatingCoupon.set(true);
    this.couponError.set('');

    const params = new HttpParams().set('code', code).set('subtotal', subtotal);
    this.http.get<CouponResult>(`${environment.apiUrl}/coupons/validate`, { params })
      .subscribe({
        next: result => {
          this.validatingCoupon.set(false);
          if (result.valid) {
            this.couponApplied.set(result);
            this.couponCode = code;
          } else {
            this.couponError.set(result.message || 'Cupón inválido');
          }
        },
        error: err => {
          this.validatingCoupon.set(false);
          this.couponError.set(err.error?.error || 'Error al validar el cupón');
        },
      });
  }

  removeCoupon(): void {
    this.couponApplied.set(null);
    this.couponCode = '';
    this.couponError.set('');
  }

  validateGiftCard(): void {
    const code = this.giftCardCode.trim().toUpperCase();
    if (!code) return;

    this.validatingGiftCard.set(true);
    this.giftCardError.set('');

    this.http.get<GiftCardResult>(`${environment.apiUrl}/gift-cards/validate/${code}`).subscribe({
      next: result => {
        this.validatingGiftCard.set(false);
        if (result.valid) {
          // Calculate how much can be applied
          const subtotal = this.cart()?.totalAmount ?? 0;
          const couponDiscount = this.couponApplied()?.discountAmount ?? 0;
          const afterCoupon = subtotal - couponDiscount;
          const discountApplied = Math.min(result.remainingAmount, afterCoupon);
          this.giftCardApplied.set({
            valid: true,
            code: result.code,
            remainingAmount: result.remainingAmount,
            discountApplied: discountApplied
          });
        } else {
          this.giftCardError.set('Gift Card inválida o sin saldo');
        }
      },
      error: err => {
        this.validatingGiftCard.set(false);
        this.giftCardError.set(err.error?.error || 'Error al validar la Gift Card');
      },
    });
  }

  removeGiftCard(): void {
    this.giftCardApplied.set(null);
    this.giftCardCode = '';
    this.giftCardError.set('');
  }

  /** sessionStorage key backing one in-progress checkout attempt (see below). */
  private static readonly IDEMPOTENCY_STORAGE_KEY = 'checkout_idempotency_key';

  /**
   * Returns a stable UUID for the current checkout *attempt*, creating one the
   * first time it's needed and reusing it on every subsequent call — including
   * after a page reload, since it's kept in sessionStorage rather than a plain
   * field.
   *
   * Why this matters: on a bad connection, a single "Confirmar pedido" click
   * can fail to get its response back even though the order was created
   * successfully on the server. Without this, the user (not seeing a result)
   * clicks again — or reloads and retries — and each attempt would create a
   * brand new order/payment charge. By sending the SAME key on every retry of
   * the same attempt, the backend recognizes it and returns the original order
   * instead of creating another one. The key is only cleared once we get a
   * confirmed response back (see next()).
   */
  private getOrCreateIdempotencyKey(): string {
    const existing = sessionStorage.getItem(CheckoutComponent.IDEMPOTENCY_STORAGE_KEY);
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem(CheckoutComponent.IDEMPOTENCY_STORAGE_KEY, key);
    return key;
  }

  private clearIdempotencyKey(): void {
    sessionStorage.removeItem(CheckoutComponent.IDEMPOTENCY_STORAGE_KEY);
  }

  startCheckout(): void {
    if (this.processing()) return; // belt-and-braces: ignore re-entrant clicks
    const c = this.cart();
    const addrId = this.selectedAddressId();
    if (!c || !addrId) return;

    this.processing.set(true);
    this.errorMessage.set('');

    this.orderService.checkout({
      idempotencyKey: this.getOrCreateIdempotencyKey(),
      cartId: c.cartId,
      shippingAddressId: addrId,
      paymentMethod: this.paymentMethod(),
      installments: this.installments(),
      couponCode: this.couponApplied() ? this.couponCode.trim().toUpperCase() : undefined,
      giftCardCode: this.giftCardApplied() ? this.giftCardCode.trim().toUpperCase() : undefined,
      shippingRateId: this.selectedShippingRateId() ?? undefined,
      pointsToRedeem: this.pointsToRedeem() > 0 ? this.pointsToRedeem() : undefined,
    }).subscribe({
      next: response => {
        // This attempt reached a confirmed order — free up the key so the
        // user's *next* purchase gets its own fresh one.
        this.clearIdempotencyKey();
        // Clear the cart so it appears empty after a successful purchase
        this.cartService.cart.set(null);
        if (response.paymentSession.checkoutUrl) {
          // MercadoPago: redirect to external checkout
          window.location.href = response.paymentSession.checkoutUrl;
        } else {
          // Transfer / Cash: go to order confirmation page
          window.location.href = `/orders/${response.orderId}?confirmed=1`;
        }
      },
      error: err => {
        this.processing.set(false);
        this.errorMessage.set(err.error?.error || 'Error al procesar el checkout');
        // Deliberately NOT clearing the idempotency key here: if this failure
        // was a network error and the order actually went through on the
        // server, retrying with the same key returns that same order instead
        // of creating a second one. If it was a real validation error (e.g.
        // "cart is empty"), the backend will just fail the same way again.
      },
    });
  }

  private resetNewAddressForm(): void {
    this.newAddress = {
      street: '', apartment: '', city: '', province: '',
      postalCode: '', notes: '', defaultAddress: false,
    };
  }
}
