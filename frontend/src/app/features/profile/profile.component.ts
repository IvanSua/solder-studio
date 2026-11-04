import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProfileService, LoyaltyProfile, PointTransaction, SavedSize } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { AddressService } from '../../core/services/address.service';
import { ToastService } from '../../core/services/toast.service';
import { WebPushService } from '../../core/services/web-push.service';
import { UserInfo } from '../../core/models/auth.model';
import { Address, AddressRequest } from '../../core/models/address.model';

type Tab = 'info' | 'password' | 'addresses' | 'loyalty' | 'security';
type TfaStep = 'idle' | 'setup' | 'disabling';

const COMMON_CATEGORIES = ['Remeras', 'Pantalones', 'Camperas', 'Vestidos', 'Calzado', 'Accesorios'];

const PROVINCES = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

const emptyAddressForm = (): AddressRequest => ({
  street: '', apartment: '', city: '', province: '', postalCode: '', notes: '', defaultAddress: false,
});

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="profile-page">
      <div class="profile-container">

        <!-- Header -->
        <div class="profile-header">
          <div class="avatar">{{ initials() }}</div>
          <div class="header-info">
            <h1>{{ fullName() }}</h1>
            <p class="email">{{ user()?.email }}</p>
            <span class="role-badge" [class]="'role-' + (user()?.role?.toLowerCase?.() ?? '')">
              {{ roleLabel() }}
            </span>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab-btn" [class.active]="activeTab() === 'info'" (click)="setTab('info')">
            Datos personales
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'password'" (click)="setTab('password')">
            Contraseña
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'addresses'" (click)="setTab('addresses')">
            Mis direcciones
            @if (addresses().length > 0) {
              <span class="tab-count">{{ addresses().length }}</span>
            }
          </button>
          <button class="tab-btn loyalty-tab" [class.active]="activeTab() === 'loyalty'" (click)="setTab('loyalty')">
            ⭐ Fidelización
            @if (loyalty()?.points) {
              <span class="tab-count">{{ loyalty()!.points }} pts</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'security'" (click)="setTab('security')">
            🔐 Seguridad
          </button>
        </div>

        <!-- ── Tab: Datos personales ─────────────────────────────── -->
        @if (activeTab() === 'info') {
          <div class="card">
            @if (loading()) {
              <div class="skeleton-form">
                @for (_ of [1,2,3]; track $index) {
                  <div class="skeleton-field">
                    <div class="skeleton sk-label"></div>
                    <div class="skeleton sk-input"></div>
                  </div>
                }
              </div>
            } @else {
              <form (ngSubmit)="saveProfile()" #profileForm="ngForm">
                <div class="form-row">
                  <div class="form-group">
                    <label>Nombre</label>
                    <input type="text" name="firstName" [(ngModel)]="profileData.firstName"
                           required minlength="2" #fnRef="ngModel"
                           [class.error]="submitted() && fnRef.invalid" />
                    @if (submitted() && fnRef.invalid) {
                      <span class="err-msg">Requerido</span>
                    }
                  </div>
                  <div class="form-group">
                    <label>Apellido</label>
                    <input type="text" name="lastName" [(ngModel)]="profileData.lastName"
                           required minlength="2" #lnRef="ngModel"
                           [class.error]="submitted() && lnRef.invalid" />
                    @if (submitted() && lnRef.invalid) {
                      <span class="err-msg">Requerido</span>
                    }
                  </div>
                </div>
                <div class="form-group">
                  <label>Email</label>
                  <input id="profileEmail" type="email" [value]="user()?.email || ''" disabled class="disabled" aria-describedby="email-hint" />
                  <span id="email-hint" class="hint">El email no se puede cambiar</span>
                </div>
                <div class="form-group">
                  <label>Teléfono</label>
                  <input type="tel" name="phone" [(ngModel)]="profileData.phone"
                         placeholder="+54 9 11 0000-0000" />
                </div>
                <div class="form-group">
                  <label>CUIT / DNI <span class="hint-inline">(opcional, para facturación)</span></label>
                  <input type="text" name="cuit" [(ngModel)]="profileData.cuit"
                         placeholder="Ej: 20-12345678-9 o 12345678"
                         maxlength="13" />
                </div>
                <div class="form-group">
                  <label>Miembro desde</label>
                  <input type="text" [value]="memberSince()" disabled class="disabled" />
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary" [disabled]="saving()">
                    @if (saving()) { Guardando… } @else { Guardar cambios }
                  </button>
                </div>
              </form>
            }
          </div>
        }

        <!-- ── Tab: Cambiar contraseña ────────────────────────────── -->
        @if (activeTab() === 'password') {
          <div class="card">
            <form (ngSubmit)="changePassword()" #pwForm="ngForm">
              <div class="form-group">
                <label>Contraseña actual</label>
                <div class="input-wrap">
                  <input [type]="showCurrent() ? 'text' : 'password'" name="currentPassword"
                         [(ngModel)]="passwordData.currentPassword" required #cpRef="ngModel"
                         [class.error]="pwSubmitted() && cpRef.invalid"
                         placeholder="Tu contraseña actual" />
                  <button type="button" class="eye-btn" (click)="showCurrent.set(!showCurrent())">
                    {{ showCurrent() ? '🙈' : '👁' }}
                  </button>
                </div>
                @if (pwSubmitted() && cpRef.invalid) { <span class="err-msg">Requerido</span> }
              </div>
              <div class="form-group">
                <label>Nueva contraseña</label>
                <div class="input-wrap">
                  <input [type]="showNew() ? 'text' : 'password'" name="newPassword"
                         [(ngModel)]="passwordData.newPassword" required minlength="6" #npRef="ngModel"
                         [class.error]="pwSubmitted() && npRef.invalid"
                         placeholder="Mínimo 6 caracteres" />
                  <button type="button" class="eye-btn" (click)="showNew.set(!showNew())">
                    {{ showNew() ? '🙈' : '👁' }}
                  </button>
                </div>
                @if (pwSubmitted() && npRef.errors?.['minlength']) {
                  <span class="err-msg">Mínimo 6 caracteres</span>
                }
              </div>
              <div class="form-group">
                <label>Confirmar nueva contraseña</label>
                <div class="input-wrap">
                  <input [type]="showConfirm() ? 'text' : 'password'" name="confirmPassword"
                         [(ngModel)]="passwordData.confirmPassword" required #cfRef="ngModel"
                         [class.error]="pwSubmitted() && passwordData.newPassword !== passwordData.confirmPassword"
                         placeholder="Repetí la nueva contraseña" />
                  <button type="button" class="eye-btn" (click)="showConfirm.set(!showConfirm())">
                    {{ showConfirm() ? '🙈' : '👁' }}
                  </button>
                </div>
                @if (pwSubmitted() && passwordData.newPassword !== passwordData.confirmPassword) {
                  <span class="err-msg">Las contraseñas no coinciden</span>
                }
              </div>
              @if (pwError()) { <div class="alert-error">{{ pwError() }}</div> }
              <div class="form-actions">
                <button type="submit" class="btn-primary" [disabled]="pwSaving()">
                  @if (pwSaving()) { Cambiando… } @else { Cambiar contraseña }
                </button>
              </div>
            </form>
          </div>
        }

        <!-- ── Tab: Mis Direcciones ───────────────────────────────── -->
        @if (activeTab() === 'addresses') {
          <div class="addresses-section">

            <!-- Address list -->
            @if (addrLoading()) {
              <div class="card addr-skeleton">
                @for (_ of [1,2]; track $index) {
                  <div class="skeleton-addr">
                    <div class="skeleton sk-addr-title"></div>
                    <div class="skeleton sk-addr-line"></div>
                    <div class="skeleton sk-addr-line short"></div>
                  </div>
                }
              </div>
            } @else if (addresses().length === 0 && !showAddrForm()) {
              <div class="empty-state">
                <div class="empty-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-secondary)">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <p>Todavía no tenés direcciones guardadas.</p>
                <button class="btn-primary" (click)="openAddressForm()">
                  + Agregar dirección
                </button>
              </div>
            } @else if (!showAddrForm()) {
              <div class="addr-list">
                @for (addr of addresses(); track addr.id) {
                  <div class="addr-card" [class.default-card]="addr.defaultAddress">
                    <div class="addr-body">
                      <div class="addr-top">
                        @if (addr.defaultAddress) {
                          <span class="default-badge">Predeterminada</span>
                        }
                      </div>
                      <p class="addr-street">
                        {{ addr.street }}{{ addr.apartment ? ', ' + addr.apartment : '' }}
                      </p>
                      <p class="addr-city">{{ addr.city }}, {{ addr.province }} ({{ addr.postalCode }})</p>
                      @if (addr.notes) {
                        <p class="addr-notes">{{ addr.notes }}</p>
                      }
                    </div>
                    <div class="addr-actions">
                      @if (!addr.defaultAddress) {
                        <button class="btn-outline-sm" (click)="setDefault(addr)"
                                [disabled]="addrSaving()">
                          Predeterminar
                        </button>
                      }
                      <button class="btn-icon" title="Editar" (click)="openEditForm(addr)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button class="btn-icon danger" title="Eliminar" (click)="deleteAddress(addr)"
                              [disabled]="addrSaving()">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                }

                <button class="btn-add-addr" (click)="openAddressForm()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Agregar otra dirección
                </button>
              </div>
            }

            <!-- Add / Edit form -->
            @if (showAddrForm()) {
              <div class="card">
                <h3 class="form-title">
                  {{ editingAddrId() ? 'Editar dirección' : 'Nueva dirección' }}
                </h3>
                <form (ngSubmit)="saveAddress()" #addrForm="ngForm">
                  <div class="form-group">
                    <label>Calle y número <span class="req">*</span></label>
                    <input type="text" name="street" [(ngModel)]="addrData.street" required
                           placeholder="Ej: Av. Corrientes 1234" #strRef="ngModel"
                           [class.error]="addrSubmitted() && strRef.invalid" />
                    @if (addrSubmitted() && strRef.invalid) { <span class="err-msg">Requerido</span> }
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>Piso / Dpto</label>
                      <input type="text" name="apartment" [(ngModel)]="addrData.apartment"
                             placeholder="Ej: 3B" />
                    </div>
                    <div class="form-group">
                      <label>Código postal <span class="req">*</span></label>
                      <input type="text" name="postalCode" [(ngModel)]="addrData.postalCode"
                             required placeholder="Ej: C1043" #cpRef="ngModel"
                             [class.error]="addrSubmitted() && cpRef.invalid" />
                      @if (addrSubmitted() && cpRef.invalid) { <span class="err-msg">Requerido</span> }
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>Ciudad <span class="req">*</span></label>
                      <input type="text" name="city" [(ngModel)]="addrData.city" required
                             placeholder="Ej: Buenos Aires" #ctRef="ngModel"
                             [class.error]="addrSubmitted() && ctRef.invalid" />
                      @if (addrSubmitted() && ctRef.invalid) { <span class="err-msg">Requerido</span> }
                    </div>
                    <div class="form-group">
                      <label>Provincia <span class="req">*</span></label>
                      <select name="province" [(ngModel)]="addrData.province" required
                              #pvRef="ngModel"
                              [class.error]="addrSubmitted() && pvRef.invalid">
                        <option value="">Seleccioná...</option>
                        @for (prov of provinces; track prov) {
                          <option [value]="prov">{{ prov }}</option>
                        }
                      </select>
                      @if (addrSubmitted() && pvRef.invalid) { <span class="err-msg">Requerido</span> }
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Notas de entrega</label>
                    <input type="text" name="notes" [(ngModel)]="addrData.notes"
                           placeholder="Ej: Timbre roto, llamar al cel." />
                  </div>

                  <label class="checkbox-label" for="addrDefaultAddress">
                    <input id="addrDefaultAddress" type="checkbox" name="defaultAddress" [(ngModel)]="addrData.defaultAddress" />
                    Establecer como dirección predeterminada
                  </label>

                  <div class="form-actions gap">
                    <button type="button" class="btn-outline" (click)="cancelAddrForm()">
                      Cancelar
                    </button>
                    <button type="submit" class="btn-primary" [disabled]="addrSaving()">
                      @if (addrSaving()) { Guardando… } @else { Guardar dirección }
                    </button>
                  </div>
                </form>
              </div>
            }
          </div>
        }

        <!-- ── Tab: Fidelización ───────────────────────────────────── -->
        @if (activeTab() === 'loyalty') {
          <div class="loyalty-section">

            @if (loyaltyLoading()) {
              <div class="loyalty-loading">
                <div class="spinner"></div>
                <span>Cargando tu perfil de fidelización...</span>
              </div>
            } @else {
              @if (loyalty(); as loy) {

              <!-- Level card -->
              <div class="level-card" [class]="'level-' + loy.level.toLowerCase()">
                <div class="level-icon">{{ levelIcon(loy.level) }}</div>
                <div class="level-info">
                  <div class="level-name">Nivel {{ loy.levelLabel }}</div>
                  <div class="points-display">{{ loy.points }} puntos</div>
                </div>
              </div>

              <!-- Progress bar to next level -->
              @if (loy.level !== 'PLATINUM') {
                <div class="progress-section">
                  <div class="progress-label">
                    <span>{{ loy.level === 'BRONZE' ? 'Plata' : loy.level === 'SILVER' ? 'Oro' : 'Platino' }} en {{ loy.pointsToNextLevel }} pts más</span>
                    <span class="progress-fraction">{{ loy.points }} / {{ loy.nextLevelPoints }}</span>
                  </div>
                  <div class="progress-track">
                    <div class="progress-fill" [class]="'fill-' + loy.level.toLowerCase()"
                      [style.width.%]="loy.levelProgress * 100"></div>
                  </div>
                </div>
              } @else {
                <p class="platinum-msg">🎉 ¡Sos miembro Platino! El nivel más alto.</p>
              }

              <!-- Level benefits -->
              <div class="benefits-row">
                @for (b of levelBenefits(loy.level); track b.icon) {
                  <div class="benefit-chip">
                    <span>{{ b.icon }}</span>
                    <span>{{ b.text }}</span>
                  </div>
                }
              </div>

              <!-- Referral code -->
              <div class="loyalty-card">
                <div class="card-header">
                  <h3>🔗 Tu código de referido</h3>
                  @if (loy.referralCount > 0) {
                    <span class="ref-count">{{ loy.referralCount }} amigo{{ loy.referralCount !== 1 ? 's' : '' }}</span>
                  }
                </div>
                <p class="referral-desc">Compartí tu código y recibís <strong>200 pts</strong> por cada amigo que se registre. Ellos reciben <strong>50 pts</strong>.</p>
                <div class="referral-code-row">
                  <code class="referral-code">{{ loy.referralCode }}</code>
                  <button class="btn-copy" (click)="copyReferralCode(loy.referralCode)">
                    @if (codeCopied()) { ✓ Copiado } @else { Copiar }
                  </button>
                </div>
              </div>

              <!-- Saved sizes -->
              <div class="loyalty-card">
                <h3>👕 Mis talles guardados</h3>
                <p class="sizes-desc">Guardá tu talle por categoría para agilizar tus compras.</p>
                <div class="sizes-grid">
                  @for (cat of commonCategories; track cat) {
                    <div class="size-row">
                      <span class="size-cat">{{ cat }}</span>
                      <select class="size-select"
                        [value]="getSavedSize(loy.savedSizes, cat)"
                        (change)="onSizeChange(cat, $any($event.target).value)">
                        <option value="">— Sin talle —</option>
                        @for (s of availableSizes; track s) {
                          <option [value]="s">{{ s }}</option>
                        }
                      </select>
                    </div>
                  }
                </div>
                <button class="btn-primary" style="margin-top: 1rem; align-self: flex-start"
                  [disabled]="savingSizes()" (click)="saveSizes()">
                  @if (savingSizes()) { Guardando… } @else { Guardar talles }
                </button>
              </div>

              <!-- Points history -->
              <div class="loyalty-card">
                <h3>📋 Historial de puntos</h3>
                @if (pointsHistory().length === 0 && !historyLoading()) {
                  <p class="no-history">Todavía no tenés movimientos de puntos.</p>
                } @else if (historyLoading()) {
                  <p class="no-history">Cargando...</p>
                } @else {
                  <div class="history-list">
                    @for (tx of pointsHistory(); track tx.id) {
                      <div class="history-row">
                        <div class="history-left">
                          <span class="history-reason">{{ reasonLabel(tx.reason) }}</span>
                          <span class="history-date">{{ formatDate(tx.createdAt) }}</span>
                        </div>
                        <span class="history-amount" [class.positive]="tx.amount > 0" [class.negative]="tx.amount < 0">
                          {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }} pts
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>

              } <!-- end @if loyalty -->
            } <!-- end @else -->
          </div>
        }

        <!-- ── Tab: Seguridad ─────────────────────────────────────── -->
        @if (activeTab() === 'security') {
          <div class="security-section">

            <!-- Email verification status -->
            <div class="security-card">
              <div class="sec-row">
                <div class="sec-info">
                  <span class="sec-label">Verificación de email</span>
                  <span class="sec-sub">{{ user()?.email }}</span>
                </div>
                @if (user()?.emailVerified) {
                  <span class="badge-ok">✓ Verificado</span>
                } @else {
                  <span class="badge-warn">Sin verificar</span>
                }
              </div>
              @if (!user()?.emailVerified) {
                <div class="sec-footer">
                  <button class="btn-outline-sm" [disabled]="tfaLoading()" (click)="resendVerification()">
                    {{ tfaLoading() ? 'Enviando...' : 'Reenviar email de verificación' }}
                  </button>
                </div>
              }
            </div>

            <!-- 2FA card -->
            <div class="security-card">
              @if (tfaStep() === 'idle') {
                <div class="sec-row">
                  <div class="sec-info">
                    <span class="sec-label">Verificación en dos pasos (2FA)</span>
                    <span class="sec-sub">Protegé tu cuenta con Google Authenticator o Authy</span>
                  </div>
                  @if (user()?.twoFactorEnabled) {
                    <span class="badge-ok">✓ Activo</span>
                  } @else {
                    <span class="badge-off">Inactivo</span>
                  }
                </div>
                <div class="sec-footer">
                  @if (user()?.twoFactorEnabled) {
                    <button class="btn-danger-outline" (click)="startDisable2FA()">Desactivar 2FA</button>
                  } @else {
                    <button class="btn-outline-sm" (click)="startSetup2FA()" [disabled]="tfaLoading()">
                      {{ tfaLoading() ? 'Cargando...' : 'Activar 2FA' }}
                    </button>
                  }
                </div>
              }

              <!-- SETUP FLOW: show QR + code input -->
              @if (tfaStep() === 'setup') {
                <h3 class="tfa-title">Configurar autenticador</h3>
                <p class="tfa-instructions">
                  Escaneá el código QR con Google Authenticator o Authy. Si no podés escanearlo,
                  ingresá la clave manual.
                </p>

                <!-- QR code via public API -->
                @if (tfaSetupData()?.otpauthUri) {
                  <div class="qr-wrap">
                    <img [src]="qrImageUrl()" alt="Código QR para 2FA" width="180" height="180" />
                  </div>
                }

                <!-- Manual key -->
                <div class="secret-box">
                  <span class="secret-label">Clave manual:</span>
                  <code class="secret-key">{{ tfaSetupData()?.secret }}</code>
                </div>

                @if (tfaError()) {
                  <div class="tfa-error">{{ tfaError() }}</div>
                }

                <div class="form-group" style="margin-top:1.25rem">
                  <label>Código de verificación (6 dígitos)</label>
                  <input type="text" [(ngModel)]="tfaCode" name="tfaCode"
                         placeholder="000000" maxlength="6" pattern="[0-9]{6}"
                         style="letter-spacing:0.3em;text-align:center;font-size:1.25rem;font-weight:700;" />
                </div>
                <div class="form-actions gap">
                  <button class="btn-outline" (click)="cancelTfa()">Cancelar</button>
                  <button class="btn-primary" [disabled]="tfaLoading() || tfaCode.length !== 6" (click)="confirmEnable2FA()">
                    {{ tfaLoading() ? 'Verificando...' : 'Activar 2FA' }}
                  </button>
                </div>
              }

              <!-- DISABLE FLOW: confirm with code -->
              @if (tfaStep() === 'disabling') {
                <h3 class="tfa-title">Desactivar 2FA</h3>
                <p class="tfa-instructions">
                  Para confirmar, ingresá el código de 6 dígitos de tu app de autenticación.
                </p>
                @if (tfaError()) {
                  <div class="tfa-error">{{ tfaError() }}</div>
                }
                <div class="form-group" style="margin-top:1.25rem">
                  <label>Código de verificación</label>
                  <input type="text" [(ngModel)]="tfaCode" name="tfaCode"
                         placeholder="000000" maxlength="6" pattern="[0-9]{6}"
                         style="letter-spacing:0.3em;text-align:center;font-size:1.25rem;font-weight:700;" />
                </div>
                <div class="form-actions gap">
                  <button class="btn-outline" (click)="cancelTfa()">Cancelar</button>
                  <button class="btn-danger-outline" [disabled]="tfaLoading() || tfaCode.length !== 6" (click)="confirmDisable2FA()">
                    {{ tfaLoading() ? 'Desactivando...' : 'Confirmar desactivación' }}
                  </button>
                </div>
              }
            </div>

            <!-- Push notifications card -->
            @if (pushSupported) {
              <div class="security-card">
                <div class="sec-row">
                  <div class="sec-info">
                    <span class="sec-label">Notificaciones push</span>
                    <span class="sec-sub">Recibí alertas de pedidos y novedades en tu dispositivo</span>
                  </div>
                  @if (pushPermission() === 'denied') {
                    <span class="badge-denied">Bloqueado</span>
                  } @else if (pushSubscribed()) {
                    <span class="badge-ok">✓ Activo</span>
                  } @else {
                    <span class="badge-off">Inactivo</span>
                  }
                </div>
                @if (pushPermission() === 'denied') {
                  <div class="sec-footer">
                    <p class="push-blocked-msg">
                      Tu navegador bloqueó las notificaciones. Para activarlas, hacé clic en el ícono de candado en la barra de dirección y habilitá los permisos de notificación.
                    </p>
                  </div>
                } @else {
                  <div class="sec-footer">
                    <button class="btn-outline-sm" [disabled]="pushLoading()" (click)="togglePush()">
                      {{ pushLoading() ? 'Procesando...' : pushSubscribed() ? 'Desactivar notificaciones' : 'Activar notificaciones' }}
                    </button>
                  </div>
                }
              </div>
            }

          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .profile-page { min-height: 100vh; background: var(--bg); padding: 2rem 1rem; }
    .profile-container { max-width: 640px; margin: 0 auto; }

    /* Header */
    .profile-header {
      display: flex; align-items: center; gap: 1.25rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07); margin-bottom: 1.25rem;
    }
    .avatar {
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-dark), var(--primary));
      color: white; font-size: 1.5rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .header-info h1 { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0 0 0.2rem; }
    .header-info .email { font-size: 0.875rem; color: var(--text-secondary); margin: 0 0 0.5rem; }
    .role-badge {
      display: inline-block; padding: 0.2rem 0.6rem; border-radius: 99px;
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .role-admin   { background: var(--warning-bg); color: var(--warning-text); }
    .role-worker  { background: var(--info-bg); color: var(--info-text); }
    .role-customer{ background: var(--success-bg); color: var(--success-text); }

    /* Tabs */
    .tabs {
      display: flex; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07); margin-bottom: 1.25rem; overflow: hidden;
    }
    .tab-btn {
      flex: 1; padding: 0.85rem; border: none; background: none;
      cursor: pointer; font-size: 0.875rem; font-weight: 500; color: var(--text-secondary);
      transition: all 0.15s; border-bottom: 2px solid transparent;
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    }
    .tab-btn.active { color: var(--primary-dark); border-bottom-color: var(--primary-dark); background: var(--primary-light); }
    .tab-btn:hover:not(.active) { background: var(--bg-secondary); color: var(--text); }
    .tab-count {
      background: var(--primary-dark); color: white; border-radius: 99px;
      font-size: 0.65rem; font-weight: 700; padding: 1px 6px; line-height: 1.4;
    }

    /* Card */
    .card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    }

    /* Form */
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1.25rem; }
    .form-title { margin: 0 0 1.5rem; font-size: 1rem; font-weight: 600; color: var(--text); }
    label { font-size: 0.875rem; font-weight: 600; color: var(--text); }
    .req { color: var(--danger); }
    input, select {
      padding: 0.6rem 0.85rem; border: 1.5px solid var(--border); border-radius: 8px;
      font-size: 0.9rem; outline: none; transition: border-color 0.15s;
      background: var(--bg-secondary); color: var(--text);
    }
    input:focus, select:focus { border-color: var(--primary); }
    input.error, select.error { border-color: var(--danger); }
    input.disabled { background: var(--bg-secondary); color: var(--text-secondary); cursor: not-allowed; }
    .hint { font-size: 0.78rem; color: var(--text-secondary); }
    .hint-inline { font-size: 0.78rem; color: var(--text-secondary); font-weight: 400; }
    .err-msg { font-size: 0.78rem; color: var(--danger); }

    .checkbox-label {
      display: flex; align-items: center; gap: 0.5rem; cursor: pointer;
      font-size: 0.875rem; font-weight: 500; color: var(--text); margin-bottom: 1.25rem;
    }
    .checkbox-label input[type="checkbox"] {
      width: 16px; height: 16px; padding: 0; border: 1.5px solid var(--border); border-radius: 4px;
      flex-shrink: 0;
    }

    .input-wrap { position: relative; display: flex; }
    .input-wrap input { flex: 1; padding-right: 2.5rem; }
    .eye-btn {
      position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
      border: none; background: none; cursor: pointer; font-size: 1rem; padding: 0;
    }

    .alert-error {
      background: var(--danger-bg); color: var(--danger-text); border-radius: 8px;
      padding: 0.75rem 1rem; font-size: 0.875rem; margin-bottom: 1rem;
    }

    .form-actions { display: flex; justify-content: flex-end; margin-top: 0.5rem; }
    .form-actions.gap { gap: 0.75rem; }
    .btn-primary {
      background: var(--primary-dark); color: white; border: none;
      padding: 0.65rem 1.75rem; border-radius: 8px; font-weight: 600;
      font-size: 0.9rem; cursor: pointer; transition: background 0.15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline {
      background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border);
      padding: 0.65rem 1.25rem; border-radius: 8px; font-weight: 500;
      font-size: 0.9rem; cursor: pointer; transition: border-color 0.15s;
    }
    .btn-outline:hover { border-color: var(--text-secondary); }

    /* Skeleton */
    .skeleton { background: var(--border); border-radius: 6px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .skeleton-field { margin-bottom: 1.25rem; }
    .sk-label { height: 14px; width: 80px; margin-bottom: 0.4rem; }
    .sk-input { height: 40px; width: 100%; }

    /* ── Addresses ──────────────────────────────────────── */
    .addresses-section { display: flex; flex-direction: column; gap: 0; }
    .addr-skeleton { display: flex; flex-direction: column; gap: 1.25rem; }
    .skeleton-addr { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.5rem 0; }
    .sk-addr-title { height: 16px; width: 120px; }
    .sk-addr-line  { height: 14px; width: 90%; }
    .sk-addr-line.short { width: 60%; }

    .empty-state {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
      display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center;
    }
    .empty-state p { color: var(--text-secondary); margin: 0; }
    .empty-icon { color: var(--text-muted); }

    .addr-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .addr-card {
      background: var(--bg-card); border-radius: 12px; padding: 1.1rem 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07); border: 1.5px solid var(--border);
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
    }
    .addr-card.default-card { border-color: var(--primary); }
    .addr-body { flex: 1; }
    .addr-top { margin-bottom: 0.4rem; }
    .default-badge {
      display: inline-block; background: var(--primary-light); color: var(--primary-dark);
      font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 99px;
    }
    .addr-street { margin: 0 0 0.2rem; font-weight: 600; color: var(--text); font-size: 0.9rem; }
    .addr-city { margin: 0 0 0.2rem; font-size: 0.85rem; color: var(--text-secondary); }
    .addr-notes { margin: 0; font-size: 0.8rem; color: var(--text-secondary); font-style: italic; }

    .addr-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
    .btn-outline-sm {
      background: var(--bg-card); color: var(--text); border: 1.5px solid var(--border);
      padding: 0.3rem 0.75rem; border-radius: 6px; font-size: 0.78rem;
      cursor: pointer; font-weight: 500; white-space: nowrap;
    }
    .btn-outline-sm:hover:not(:disabled) { border-color: var(--primary); color: var(--primary-dark); }
    .btn-outline-sm:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-icon {
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      border: 1.5px solid var(--border); border-radius: 6px; background: var(--bg-card);
      cursor: pointer; color: var(--text-secondary); transition: all 0.12s;
    }
    .btn-icon:hover { border-color: var(--primary); color: var(--primary-dark); }
    .btn-icon.danger:hover { border-color: var(--danger); color: var(--danger-text); background: var(--danger-bg); }
    .btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-add-addr {
      display: flex; align-items: center; gap: 0.5rem;
      margin-top: 0.25rem; background: var(--bg-card); border: 1.5px dashed var(--border);
      border-radius: 10px; padding: 0.85rem 1.25rem; font-size: 0.875rem;
      font-weight: 500; color: var(--text-secondary); cursor: pointer; width: 100%;
      transition: all 0.15s;
    }
    .btn-add-addr:hover { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-light); }

    /* Loyalty section */
    .loyalty-section { display: flex; flex-direction: column; gap: 1rem; }
    .loyalty-loading {
      display: flex; align-items: center; gap: 0.75rem; color: var(--text-muted);
      font-size: 0.875rem; padding: 2rem 0; justify-content: center;
    }
    .spinner {
      width: 18px; height: 18px; border: 2px solid var(--border);
      border-top-color: var(--primary); border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Level card */
    .level-card {
      display: flex; align-items: center; gap: 1.25rem;
      border-radius: 14px; padding: 1.25rem 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .level-bronze  { background: linear-gradient(135deg, #fef3c7, #fde68a); }
    .level-silver  { background: linear-gradient(135deg, #f3f4f6, #e5e7eb); }
    .level-gold    { background: linear-gradient(135deg, #fef9c3, #fde047); }
    .level-platinum{ background: linear-gradient(135deg, #ede9fe, #ddd6fe); }
    .level-icon { font-size: 2rem; flex-shrink: 0; }
    /* Fixed dark color (not var(--text)) — these cards keep the same light
       pastel gradient in both themes, so the text must stay dark regardless
       of dark mode (var(--text) turns near-white there, killing contrast). */
    .level-name { font-size: 1rem; font-weight: 700; color: #292524; }
    .points-display { font-size: 1.5rem; font-weight: 800; color: #292524; margin-top: 0.15rem; }

    /* Progress */
    .progress-section { display: flex; flex-direction: column; gap: 0.4rem; }
    .progress-label {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.8rem; color: var(--text-secondary);
    }
    .progress-fraction { font-weight: 600; color: var(--text); }
    .progress-track {
      height: 10px; background: var(--border); border-radius: 5px; overflow: hidden;
    }
    .progress-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
    .fill-bronze  { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .fill-silver  { background: linear-gradient(90deg, #9ca3af, #6b7280); }
    .fill-gold    { background: linear-gradient(90deg, #eab308, #ca8a04); }
    .platinum-msg { color: var(--info-text); font-weight: 600; font-size: 0.9rem; margin: 0; }

    /* Benefits chips */
    .benefits-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .benefit-chip {
      display: flex; align-items: center; gap: 0.35rem;
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 20px;
      padding: 0.3rem 0.75rem; font-size: 0.78rem; color: var(--text); font-weight: 500;
    }

    /* Loyalty cards */
    .loyalty-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px;
      padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .loyalty-card h3 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text); }
    .card-header { display: flex; align-items: center; gap: 0.75rem; }
    .ref-count {
      font-size: 0.75rem; background: var(--success-bg); color: var(--success-text);
      padding: 2px 8px; border-radius: 12px; font-weight: 600;
    }
    .referral-desc, .sizes-desc { margin: 0; font-size: 0.85rem; color: var(--text-secondary); }
    .referral-code-row { display: flex; align-items: center; gap: 0.75rem; }
    .referral-code {
      flex: 1; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
      padding: 0.6rem 1rem; font-family: monospace; font-size: 1rem; font-weight: 700;
      letter-spacing: 0.1em; color: var(--text);
    }
    .btn-copy {
      padding: 0.5rem 1rem; background: var(--primary); color: white; border: none;
      border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
      white-space: nowrap; transition: background 0.15s;
    }
    .btn-copy:hover { background: var(--primary-dark); }

    /* Saved sizes */
    .sizes-grid { display: flex; flex-direction: column; gap: 0.5rem; }
    .size-row {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    }
    .size-cat { font-size: 0.875rem; font-weight: 500; color: var(--text); flex: 1; }
    .size-select {
      padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px;
      font-size: 0.85rem; background: var(--bg-secondary); color: var(--text); cursor: pointer; min-width: 120px;
      transition: border-color 0.15s;
    }
    .size-select:focus { outline: none; border-color: var(--primary); }

    /* Points history */
    .no-history { color: var(--text-secondary); font-size: 0.875rem; margin: 0; }
    .history-list { display: flex; flex-direction: column; gap: 0; }
    .history-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 0; border-bottom: 1px solid var(--border);
    }
    .history-row:last-child { border-bottom: none; }
    .history-left { display: flex; flex-direction: column; gap: 0.15rem; }
    .history-reason { font-size: 0.875rem; font-weight: 500; color: var(--text); }
    .history-date { font-size: 0.75rem; color: var(--text-secondary); }
    .history-amount { font-weight: 700; font-size: 0.9rem; }
    .history-amount.positive { color: var(--success); }
    .history-amount.negative { color: var(--danger); }

    .loyalty-tab { position: relative; }
    .tab-loyalty-active { border-color: var(--warning); color: var(--warning-text); }

    /* ── Security tab ───────────────────────────────────────── */
    .security-section { display: flex; flex-direction: column; gap: 1rem; }
    .security-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.07);
    }
    .sec-row {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
    }
    .sec-info { display: flex; flex-direction: column; gap: 0.25rem; }
    .sec-label { font-size: 0.9rem; font-weight: 600; color: var(--text); }
    .sec-sub { font-size: 0.8rem; color: var(--text-secondary); }
    .sec-footer { margin-top: 1rem; }
    .badge-ok {
      flex-shrink: 0; padding: 0.25rem 0.65rem; border-radius: 99px;
      background: var(--success-bg); color: var(--success-text); font-size: 0.75rem; font-weight: 600;
    }
    .badge-warn {
      flex-shrink: 0; padding: 0.25rem 0.65rem; border-radius: 99px;
      background: var(--warning-bg); color: var(--warning-text); font-size: 0.75rem; font-weight: 600;
    }
    .badge-off {
      flex-shrink: 0; padding: 0.25rem 0.65rem; border-radius: 99px;
      background: var(--bg-secondary); color: var(--text-secondary); font-size: 0.75rem; font-weight: 600;
    }
    .badge-denied {
      flex-shrink: 0; padding: 0.25rem 0.65rem; border-radius: 99px;
      background: var(--danger-bg); color: var(--danger-text); font-size: 0.75rem; font-weight: 600;
    }
    .push-blocked-msg {
      margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;
    }
    .btn-danger-outline {
      padding: 0.5rem 1rem; border: 1.5px solid var(--danger-border); border-radius: 8px;
      background: var(--bg-card); color: var(--danger); font-size: 0.85rem; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-danger-outline:hover:not(:disabled) { background: var(--danger-bg); border-color: var(--danger); }
    .btn-danger-outline:disabled { opacity: 0.6; cursor: not-allowed; }
    .tfa-title { margin: 0 0 0.5rem; font-size: 1rem; font-weight: 600; color: var(--text); }
    .tfa-instructions { margin: 0 0 1rem; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; }
    .qr-wrap { display: flex; justify-content: center; margin: 1rem 0; }
    .qr-wrap img { border: 1px solid var(--border); border-radius: 8px; }
    .secret-box {
      display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
      background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px;
      padding: 0.75rem 1rem; margin-bottom: 0.5rem;
    }
    .secret-label { font-size: 0.8rem; color: var(--text-secondary); font-weight: 500; }
    .secret-key {
      font-family: monospace; font-size: 0.9rem; font-weight: 600;
      color: var(--primary); letter-spacing: 0.1em; word-break: break-all;
    }
    .tfa-error {
      background: var(--danger-bg); color: var(--danger-text); border-radius: 8px;
      padding: 0.65rem 1rem; font-size: 0.875rem; margin-bottom: 0.5rem;
    }

    @media (max-width: 600px) {
      .form-row { grid-template-columns: 1fr; }
      .profile-header { flex-direction: column; text-align: center; }
      .addr-card { flex-direction: column; }
      .addr-actions { align-self: flex-end; }
      .tab-btn { font-size: 0.78rem; padding: 0.75rem 0.4rem; }
      .size-row { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
      .size-select { min-width: 100%; }
    }
  `],
})
export class ProfileComponent implements OnInit {
  readonly provinces = PROVINCES;
  readonly commonCategories = COMMON_CATEGORIES;
  readonly availableSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

  // ── User profile state ────────────────────────────────────────────────────
  user = signal<UserInfo | null>(null);
  loading = signal(true);
  saving = signal(false);
  submitted = signal(false);
  pwSaving = signal(false);
  pwSubmitted = signal(false);
  pwError = signal<string | null>(null);
  activeTab = signal<Tab>('info');
  showCurrent = signal(false);
  showNew = signal(false);
  showConfirm = signal(false);

  profileData = { firstName: '', lastName: '', phone: '', cuit: '' };
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };

  // ── Address state ──────────────────────────────────────────────────────────
  addresses = signal<Address[]>([]);
  addrLoading = signal(false);
  addrSaving = signal(false);
  addrSubmitted = signal(false);
  showAddrForm = signal(false);
  editingAddrId = signal<number | null>(null);
  addrData: AddressRequest = emptyAddressForm();

  // ── 2FA / Security state ──────────────────────────────────────────────────
  tfaStep = signal<TfaStep>('idle');
  tfaSetupData = signal<{ secret: string; otpauthUri: string } | null>(null);
  tfaLoading = signal(false);
  tfaError = signal<string | null>(null);
  tfaCode = '';

  // ── Push notification state ────────────────────────────────────────────────
  pushSupported = false;
  pushPermission = signal<NotificationPermission>('default');
  pushSubscribed = signal(false);
  pushLoading = signal(false);

  // ── Loyalty state ─────────────────────────────────────────────────────────
  loyalty = signal<LoyaltyProfile | null>(null);
  loyaltyLoading = signal(false);
  pointsHistory = signal<PointTransaction[]>([]);
  historyLoading = signal(false);
  savingSizes = signal(false);
  codeCopied = signal(false);
  /** Local copy of saved sizes (for editing before saving) */
  pendingSizes: Record<string, string> = {};

  // ── Computed ───────────────────────────────────────────────────────────────
  fullName = computed(() => {
    const u = this.user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  });

  initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    return `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase();
  });

  roleLabel = computed(() => {
    const roles: Record<string, string> = { ADMIN: 'Administrador', WORKER: 'Empleado', CUSTOMER: 'Cliente' };
    return roles[this.user()?.role || ''] || this.user()?.role || '';
  });

  memberSince = computed(() => {
    const d = this.user()?.createdAt;
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });
  });

  /** Builds a QR code image URL from the otpauth:// URI using a public QR API */
  qrImageUrl = computed(() => {
    const uri = this.tfaSetupData()?.otpauthUri;
    if (!uri) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`;
  });

  constructor(
    private profileService: ProfileService,
    private authService: AuthService,
    private addressService: AddressService,
    private toast: ToastService,
    private webPush: WebPushService,
  ) {
    this.pushSupported = webPush.isSupported;
  }

  ngOnInit(): void {
    this.profileService.getProfile().subscribe({
      next: (u) => {
        this.user.set(u);
        this.profileData = { firstName: u.firstName, lastName: u.lastName, phone: u.phone || '', cuit: u.cuit || '' };
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.submitted.set(false);
    this.pwSubmitted.set(false);
    this.pwError.set(null);
    this.cancelAddrForm();
    this.cancelTfa();
    if (tab === 'addresses' && this.addresses().length === 0 && !this.addrLoading()) {
      this.loadAddresses();
    }
    if (tab === 'loyalty' && !this.loyalty() && !this.loyaltyLoading()) {
      this.loadLoyalty();
    }
    if (tab === 'security') {
      this.initPushState();
    }
  }

  // ── Push notification methods ──────────────────────────────────────────────
  async initPushState(): Promise<void> {
    if (!this.pushSupported) return;
    this.pushPermission.set(this.webPush.permission);
    this.pushSubscribed.set(await this.webPush.isSubscribed());
  }

  async togglePush(): Promise<void> {
    this.pushLoading.set(true);
    try {
      if (this.pushSubscribed()) {
        await this.webPush.unsubscribe();
        this.pushSubscribed.set(false);
        this.toast.success('Notificaciones push desactivadas');
      } else {
        const result = await this.webPush.subscribe();
        if (result === 'granted') {
          this.pushSubscribed.set(true);
          this.pushPermission.set('granted');
          this.toast.success('Notificaciones push activadas');
        } else if (result === 'denied') {
          this.pushPermission.set('denied');
          this.toast.error('El navegador bloqueó los permisos de notificación');
        }
      }
    } finally {
      this.pushLoading.set(false);
    }
  }

  // ── Profile methods ────────────────────────────────────────────────────────
  saveProfile(): void {
    this.submitted.set(true);
    if (!this.profileData.firstName || !this.profileData.lastName) return;
    this.saving.set(true);
    this.profileService.updateProfile(this.profileData).subscribe({
      next: (updated) => {
        this.user.set(updated);
        this.saving.set(false);
        this.submitted.set(false);
        this.toast.success('Perfil actualizado correctamente');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error al guardar el perfil');
      },
    });
  }

  changePassword(): void {
    this.pwSubmitted.set(true);
    this.pwError.set(null);
    if (!this.passwordData.currentPassword || !this.passwordData.newPassword) return;
    if (this.passwordData.newPassword.length < 6) return;
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) return;
    this.pwSaving.set(true);
    this.profileService.changePassword({
      currentPassword: this.passwordData.currentPassword,
      newPassword: this.passwordData.newPassword,
    }).subscribe({
      next: () => {
        this.pwSaving.set(false);
        this.pwSubmitted.set(false);
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
        this.toast.success('Contraseña cambiada correctamente');
      },
      error: (err) => {
        this.pwSaving.set(false);
        this.pwError.set(err?.error?.message || 'La contraseña actual es incorrecta');
      },
    });
  }

  // ── Address methods ────────────────────────────────────────────────────────
  loadAddresses(): void {
    this.addrLoading.set(true);
    this.addressService.getAddresses().subscribe({
      next: (list) => { this.addresses.set(list); this.addrLoading.set(false); },
      error: () => { this.addrLoading.set(false); this.toast.error('Error al cargar las direcciones'); },
    });
  }

  openAddressForm(): void {
    this.editingAddrId.set(null);
    this.addrData = emptyAddressForm();
    this.addrSubmitted.set(false);
    this.showAddrForm.set(true);
  }

  openEditForm(addr: Address): void {
    this.editingAddrId.set(addr.id);
    this.addrData = {
      street: addr.street,
      apartment: addr.apartment ?? '',
      city: addr.city,
      province: addr.province,
      postalCode: addr.postalCode,
      notes: addr.notes ?? '',
      defaultAddress: addr.defaultAddress,
    };
    this.addrSubmitted.set(false);
    this.showAddrForm.set(true);
  }

  cancelAddrForm(): void {
    this.showAddrForm.set(false);
    this.editingAddrId.set(null);
    this.addrData = emptyAddressForm();
    this.addrSubmitted.set(false);
  }

  saveAddress(): void {
    this.addrSubmitted.set(true);
    if (!this.addrData.street || !this.addrData.city || !this.addrData.province || !this.addrData.postalCode) return;

    this.addrSaving.set(true);
    const editId = this.editingAddrId();
    const request$ = editId
      ? this.addressService.updateAddress(editId, this.addrData)
      : this.addressService.createAddress(this.addrData);

    request$.subscribe({
      next: (saved) => {
        if (editId) {
          this.addresses.update(list => list.map(a => a.id === editId ? saved : a));
          this.toast.success('Dirección actualizada');
        } else {
          this.addresses.update(list => [...list, saved]);
          this.toast.success('Dirección agregada');
        }
        // If set as default, update flags in the list
        if (saved.defaultAddress) {
          this.addresses.update(list => list.map(a => ({ ...a, defaultAddress: a.id === saved.id })));
        }
        this.addrSaving.set(false);
        this.cancelAddrForm();
      },
      error: () => {
        this.addrSaving.set(false);
        this.toast.error('Error al guardar la dirección');
      },
    });
  }

  deleteAddress(addr: Address): void {
    if (!confirm(`¿Eliminar la dirección "${addr.street}"?`)) return;
    this.addrSaving.set(true);
    this.addressService.deleteAddress(addr.id).subscribe({
      next: () => {
        this.addresses.update(list => list.filter(a => a.id !== addr.id));
        this.addrSaving.set(false);
        this.toast.success('Dirección eliminada');
      },
      error: () => {
        this.addrSaving.set(false);
        this.toast.error('Error al eliminar la dirección');
      },
    });
  }

  setDefault(addr: Address): void {
    this.addrSaving.set(true);
    this.addressService.setDefault(addr.id).subscribe({
      next: () => {
        this.addresses.update(list => list.map(a => ({ ...a, defaultAddress: a.id === addr.id })));
        this.addrSaving.set(false);
        this.toast.success('Dirección predeterminada actualizada');
      },
      error: () => {
        this.addrSaving.set(false);
        this.toast.error('Error al actualizar');
      },
    });
  }

  // ── Loyalty methods ───────────────────────────────────────────────────────

  loadLoyalty(): void {
    this.loyaltyLoading.set(true);
    this.profileService.getLoyalty().subscribe({
      next: (loy) => {
        this.loyalty.set(loy);
        // Populate pending sizes from saved data
        this.pendingSizes = {};
        loy.savedSizes.forEach(s => { this.pendingSizes[s.categoryName] = s.size; });
        this.loyaltyLoading.set(false);
        this.loadPointsHistory();
      },
      error: () => this.loyaltyLoading.set(false),
    });
  }

  loadPointsHistory(): void {
    this.historyLoading.set(true);
    this.profileService.getPointsHistory(0, 15).subscribe({
      next: (page) => { this.pointsHistory.set(page.content); this.historyLoading.set(false); },
      error: () => this.historyLoading.set(false),
    });
  }

  copyReferralCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.codeCopied.set(true);
      setTimeout(() => this.codeCopied.set(false), 2000);
    });
  }

  getSavedSize(savedSizes: SavedSize[], category: string): string {
    return this.pendingSizes[category] ?? savedSizes.find(s => s.categoryName === category)?.size ?? '';
  }

  onSizeChange(category: string, size: string): void {
    this.pendingSizes = { ...this.pendingSizes, [category]: size };
  }

  saveSizes(): void {
    const entries = Object.entries(this.pendingSizes)
      .filter(([, size]) => !!size)
      .map(([categoryName, size]) => ({ categoryName, size }));
    if (entries.length === 0) return;
    this.savingSizes.set(true);
    this.profileService.saveSizes(entries).subscribe({
      next: (saved) => {
        this.loyalty.update(l => l ? { ...l, savedSizes: saved } : l);
        this.savingSizes.set(false);
        this.toast.success('Talles guardados correctamente');
      },
      error: () => {
        this.savingSizes.set(false);
        this.toast.error('Error al guardar los talles');
      },
    });
  }

  levelIcon(level: string): string {
    const icons: Record<string, string> = {
      BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎',
    };
    return icons[level] ?? '⭐';
  }

  levelBenefits(level: string): { icon: string; text: string }[] {
    const base = [{ icon: '🎁', text: '1 pt por c/$100' }];
    if (level === 'SILVER' || level === 'GOLD' || level === 'PLATINUM') {
      base.push({ icon: '🚚', text: 'Envío prioritario' });
    }
    if (level === 'GOLD' || level === 'PLATINUM') {
      base.push({ icon: '🏷️', text: '5% descuento' });
    }
    if (level === 'PLATINUM') {
      base.push({ icon: '👑', text: 'Atención VIP' });
    }
    return base;
  }

  reasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      ORDER_DELIVERED:         '📦 Compra entregada',
      ORDER_REDEMPTION:        '💸 Canje en checkout',
      REFERRAL_BONUS:          '🔗 Bono por referido (registro)',
      REFERRED_SIGNUP:         '🎉 Bonus de bienvenida',
      REFERRAL_FIRST_PURCHASE: '🛍️ Primera compra de tu referido',
    };
    return labels[reason] ?? reason;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ── Security / 2FA methods ────────────────────────────────────────────────

  resendVerification(): void {
    const email = this.user()?.email;
    if (!email) return;
    this.tfaLoading.set(true);
    this.authService.resendVerification(email).subscribe({
      next: () => {
        this.tfaLoading.set(false);
        this.toast.success('Email de verificación reenviado');
      },
      error: () => {
        this.tfaLoading.set(false);
        this.toast.error('Error al reenviar el email');
      },
    });
  }

  startSetup2FA(): void {
    this.tfaLoading.set(true);
    this.tfaError.set(null);
    this.tfaCode = '';
    this.authService.setup2FA().subscribe({
      next: (data) => {
        this.tfaSetupData.set(data);
        this.tfaStep.set('setup');
        this.tfaLoading.set(false);
      },
      error: () => {
        this.tfaLoading.set(false);
        this.toast.error('No se pudo iniciar la configuración de 2FA');
      },
    });
  }

  confirmEnable2FA(): void {
    this.tfaLoading.set(true);
    this.tfaError.set(null);
    this.authService.enable2FA(this.tfaCode).subscribe({
      next: () => {
        this.tfaLoading.set(false);
        this.user.update(u => u ? { ...u, twoFactorEnabled: true } : u);
        this.cancelTfa();
        this.toast.success('2FA activado correctamente');
      },
      error: (err) => {
        this.tfaLoading.set(false);
        this.tfaError.set(err.error?.error || 'Código incorrecto. Intentá de nuevo.');
      },
    });
  }

  startDisable2FA(): void {
    this.tfaCode = '';
    this.tfaError.set(null);
    this.tfaStep.set('disabling');
  }

  confirmDisable2FA(): void {
    this.tfaLoading.set(true);
    this.tfaError.set(null);
    this.authService.disable2FA(this.tfaCode).subscribe({
      next: () => {
        this.tfaLoading.set(false);
        this.user.update(u => u ? { ...u, twoFactorEnabled: false } : u);
        this.cancelTfa();
        this.toast.success('2FA desactivado');
      },
      error: (err) => {
        this.tfaLoading.set(false);
        this.tfaError.set(err.error?.error || 'Código incorrecto. Intentá de nuevo.');
      },
    });
  }

  cancelTfa(): void {
    this.tfaStep.set('idle');
    this.tfaSetupData.set(null);
    this.tfaCode = '';
    this.tfaError.set(null);
    this.tfaLoading.set(false);
  }
}
