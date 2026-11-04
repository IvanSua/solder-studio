package com.tiendaropa.service;

import com.tiendaropa.dto.request.AddressRequest;
import com.tiendaropa.dto.response.AddressResponse;
import com.tiendaropa.entity.Address;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.AddressRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AddressServiceTest {

    @Mock
    private AddressRepository addressRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private AddressService addressService;

    private User usuarioPorDefecto;

    @BeforeEach
    void setUp() {
        usuarioPorDefecto = User.builder()
                .id(1L)
                .email("test@tienda.com")
                .firstName("Juan")
                .lastName("Perez")
                .passwordHash("hash")
                .build();
    }

    private Address buildAddress(Long id, boolean esDefault) {
        return Address.builder()
                .id(id)
                .user(usuarioPorDefecto)
                .street("Av. Corrientes 1234")
                .city("Buenos Aires")
                .province("CABA")
                .postalCode("C1043")
                .defaultAddress(esDefault)
                .build();
    }

    private AddressRequest buildRequest(boolean esDefault) {
        AddressRequest req = new AddressRequest();
        req.setStreet("Av. Corrientes 1234");
        req.setCity("Buenos Aires");
        req.setProvince("CABA");
        req.setPostalCode("C1043");
        req.setDefaultAddress(esDefault);
        return req;
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class GetAddresses {

        @Test
        void retornaListaDeDireccionesDelUsuario() {
            Address dir1 = buildAddress(1L, true);
            Address dir2 = buildAddress(2L, false);
            when(addressRepository.findByUserId(1L)).thenReturn(List.of(dir1, dir2));

            List<AddressResponse> resultado = addressService.getAddresses(1L);

            assertThat(resultado).hasSize(2);
            assertThat(resultado.get(0).getStreet()).isEqualTo("Av. Corrientes 1234");
        }

        @Test
        void retornaListaVaciaWhenNoHayDirecciones() {
            when(addressRepository.findByUserId(99L)).thenReturn(List.of());

            List<AddressResponse> resultado = addressService.getAddresses(99L);

            assertThat(resultado).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class CreateAddress {

        @Test
        void primerasDireccionSeConvierteEnDefault() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(usuarioPorDefecto));
            when(addressRepository.findByUserId(1L)).thenReturn(List.of());
            Address saved = buildAddress(10L, true);
            when(addressRepository.save(any(Address.class))).thenReturn(saved);

            AddressRequest req = buildRequest(false);
            AddressResponse resultado = addressService.createAddress(1L, req);

            assertThat(resultado.isDefaultAddress()).isTrue();
            ArgumentCaptor<Address> captor = ArgumentCaptor.forClass(Address.class);
            verify(addressRepository).save(captor.capture());
            assertThat(captor.getValue().isDefaultAddress()).isTrue();
        }

        @Test
        void direccionExplicitamenteDefaultLimpiaLaAnterior() {
            Address anterior = buildAddress(5L, true);
            when(userRepository.findById(1L)).thenReturn(Optional.of(usuarioPorDefecto));
            when(addressRepository.findByUserId(1L))
                    .thenReturn(List.of(anterior))
                    .thenReturn(List.of(anterior));
            Address saved = buildAddress(10L, true);
            when(addressRepository.save(any(Address.class))).thenReturn(saved);

            AddressRequest req = buildRequest(true);
            addressService.createAddress(1L, req);

            verify(addressRepository, atLeastOnce()).save(any(Address.class));
            assertThat(anterior.isDefaultAddress()).isFalse();
        }

        @Test
        void usuarioNoExisteLanzaResourceNotFoundException() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> addressService.createAddress(99L, buildRequest(false)))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User not found");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class UpdateAddress {

        @Test
        void actualizaDireccionExistente() {
            Address existente = buildAddress(1L, false);
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existente));
            when(addressRepository.save(existente)).thenReturn(existente);

            AddressRequest req = buildRequest(false);
            req.setStreet("Calle Nueva 999");

            AddressResponse resultado = addressService.updateAddress(1L, 1L, req);

            assertThat(existente.getStreet()).isEqualTo("Calle Nueva 999");
            verify(addressRepository).save(existente);
        }

        @Test
        void direccionNoEncontradaLanzaResourceNotFoundException() {
            when(addressRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> addressService.updateAddress(1L, 99L, buildRequest(false)))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Address not found");
        }

        @Test
        void setearComoDefaultLimpiaAnterior() {
            Address existente = buildAddress(1L, false);
            Address otraDefault = buildAddress(2L, true);
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existente));
            when(addressRepository.findByUserId(1L)).thenReturn(List.of(otraDefault));
            when(addressRepository.save(any(Address.class))).thenReturn(existente);

            addressService.updateAddress(1L, 1L, buildRequest(true));

            assertThat(otraDefault.isDefaultAddress()).isFalse();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class DeleteAddress {

        @Test
        void eliminaDireccionNoDefault() {
            Address existente = buildAddress(1L, false);
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(existente));

            addressService.deleteAddress(1L, 1L);

            verify(addressRepository).delete(existente);
        }

        @Test
        void intentarEliminarDefaultLanzaBusinessException() {
            Address defaultDir = buildAddress(1L, true);
            when(addressRepository.findByIdAndUserId(1L, 1L)).thenReturn(Optional.of(defaultDir));

            assertThatThrownBy(() -> addressService.deleteAddress(1L, 1L))
                    .isInstanceOf(BusinessException.class);

            verify(addressRepository, never()).delete(any());
        }

        @Test
        void direccionNoEncontradaLanzaResourceNotFoundException() {
            when(addressRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> addressService.deleteAddress(1L, 99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Address not found");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class SetDefault {

        @Test
        void cambiaElDefaultCorrectamente() {
            Address nueva = buildAddress(2L, false);
            Address anterior = buildAddress(1L, true);
            when(addressRepository.findByIdAndUserId(2L, 1L)).thenReturn(Optional.of(nueva));
            when(addressRepository.findByUserId(1L)).thenReturn(List.of(anterior));
            when(addressRepository.save(any())).thenReturn(nueva);

            AddressResponse resultado = addressService.setDefault(1L, 2L);

            assertThat(anterior.isDefaultAddress()).isFalse();
            assertThat(nueva.isDefaultAddress()).isTrue();
        }

        @Test
        void direccionNoEncontradaLanzaResourceNotFoundException() {
            when(addressRepository.findByIdAndUserId(99L, 1L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> addressService.setDefault(1L, 99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Address not found");
        }
    }
}
