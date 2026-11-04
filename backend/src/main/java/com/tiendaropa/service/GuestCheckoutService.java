package com.tiendaropa.service;

import com.tiendaropa.dto.request.AddressRequest;
import com.tiendaropa.dto.request.CheckoutRequest;
import com.tiendaropa.dto.request.GuestCheckoutRequest;
import com.tiendaropa.dto.response.AddressResponse;
import com.tiendaropa.dto.response.CartResponse;
import com.tiendaropa.dto.response.CheckoutResponse;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checkout de invitado — permite comprar sin crear una cuenta explícitamente.
 *
 * <p>Bajo el capó, SÍ existe un {@link User}: se crea (o reutiliza) uno con
 * {@code passwordHash=""}, exactamente el mismo mecanismo que ya usan los
 * usuarios de OAuth2 (ver {@code CustomOAuth2UserService}). Esto permite
 * reutilizar el 100% del {@link CheckoutService} existente (stock, cupones,
 * gift cards, puntos, MercadoPago) sin duplicar esa lógica ni tocar código
 * que ya está en producción y probado.
 *
 * <p><b>Importante — seguridad:</b> si el email ya pertenece a una cuenta
 * "real" (tiene password o está verificada), NO se reutiliza esa cuenta.
 * Eso sería tomar control de la cuenta de otra persona sin autenticación.
 * En ese caso se rechaza el checkout y se le pide al invitado iniciar sesión.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GuestCheckoutService {

    private final UserRepository userRepository;
    private final AddressService addressService;
    private final CartService cartService;
    private final CheckoutService checkoutService;

    @Transactional
    public CheckoutResponse checkoutAsGuest(GuestCheckoutRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = resolveGuestUser(email, request);

        AddressRequest addressRequest = new AddressRequest();
        addressRequest.setStreet(request.getStreet());
        addressRequest.setApartment(request.getApartment());
        addressRequest.setCity(request.getCity());
        addressRequest.setProvince(request.getProvince());
        addressRequest.setPostalCode(request.getPostalCode());
        addressRequest.setDefaultAddress(true);
        AddressResponse address = addressService.createAddress(user.getId(), addressRequest);

        // El invitado no tiene carrito propio — se arma uno de una sola vez con
        // los items que mandó en el request, reusando el mismo CartService que
        // usa el flujo autenticado (misma validación de stock/variant). Si el
        // email ya tenía un carrito de un guest checkout anterior sin terminar,
        // se vacía primero para no arrastrar items de esa vez.
        cartService.clearCart(user.getId());
        CartResponse cart = null;
        for (var item : request.getItems()) {
            cart = cartService.addItem(user.getId(), item);
        }
        if (cart == null) {
            throw new BusinessException("El carrito está vacío", HttpStatus.BAD_REQUEST);
        }

        CheckoutRequest checkoutRequest = new CheckoutRequest();
        checkoutRequest.setIdempotencyKey(request.getIdempotencyKey());
        checkoutRequest.setCartId(cart.getCartId());
        checkoutRequest.setShippingAddressId(address.getId());
        checkoutRequest.setPaymentMethod(request.getPaymentMethod());
        checkoutRequest.setInstallments(request.getInstallments());
        checkoutRequest.setCouponCode(request.getCouponCode());
        checkoutRequest.setGiftCardCode(request.getGiftCardCode());
        checkoutRequest.setShippingRateId(request.getShippingRateId());
        checkoutRequest.setPointsToRedeem(0); // un usuario "guest" recién creado no tiene puntos

        return checkoutService.checkout(user.getId(), checkoutRequest);
    }

    /**
     * Encuentra o crea el usuario "guest" para este email.
     *
     * <ul>
     *   <li>No existe → se crea uno nuevo, sin password (igual que OAuth).</li>
     *   <li>Existe y ya es un guest de una compra anterior (sin password, no
     *       verificado) → se reutiliza, así sus pedidos quedan bajo la misma
     *       cuenta y puede reclamarla más adelante con "olvidé mi contraseña".</li>
     *   <li>Existe y es una cuenta real (tiene password o está verificada) →
     *       se rechaza. Comprar como invitado con el email de otra persona
     *       registrada NO debe dar acceso a esa cuenta.</li>
     * </ul>
     */
    private User resolveGuestUser(String email, GuestCheckoutRequest request) {
        return userRepository.findByEmail(email)
                .map(existing -> {
                    boolean hasRealAccount = existing.isEmailVerified()
                            || (existing.getPasswordHash() != null && !existing.getPasswordHash().isBlank());
                    if (hasRealAccount) {
                        throw new BusinessException(
                                "Ya existe una cuenta con este email. Iniciá sesión para continuar con la compra.",
                                HttpStatus.CONFLICT);
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    User newUser = User.builder()
                            .email(email)
                            .passwordHash("") // sin password — mismo patrón que usuarios OAuth2
                            .firstName(request.getFirstName())
                            .lastName(request.getLastName())
                            .phone(request.getPhone())
                            .build();
                    User saved = userRepository.save(newUser);
                    log.info("Guest checkout: nueva cuenta liviana creada para email={} (userId={})", email, saved.getId());
                    return saved;
                });
    }
}
