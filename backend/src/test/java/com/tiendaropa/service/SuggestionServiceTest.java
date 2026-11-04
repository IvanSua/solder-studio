package com.tiendaropa.service;

import com.tiendaropa.dto.response.SuggestionResponse;
import com.tiendaropa.entity.Suggestion;
import com.tiendaropa.entity.SuggestionVote;
import com.tiendaropa.entity.User;
import com.tiendaropa.exception.BusinessException;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.SuggestionRepository;
import com.tiendaropa.repository.SuggestionVoteRepository;
import com.tiendaropa.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SuggestionServiceTest {

    @Mock
    private SuggestionRepository suggestionRepository;

    @Mock
    private SuggestionVoteRepository voteRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private SuggestionService suggestionService;

    private User buildUser(Long id) {
        return User.builder()
                .id(id)
                .email("usuario" + id + "@tienda.com")
                .firstName("Juan")
                .lastName("Perez")
                .passwordHash("hash")
                .build();
    }

    private Suggestion buildSuggestion(Long id, int voteCount) {
        return Suggestion.builder()
                .id(id)
                .user(buildUser(1L))
                .title("Sugerencia " + id)
                .description("Descripción")
                .voteCount(voteCount)
                .status("OPEN")
                .build();
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class Create {

        @Test
        void creasugerenciaConTituloValido() {
            User user = buildUser(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(user));
            Suggestion saved = buildSuggestion(10L, 0);
            when(suggestionRepository.save(any(Suggestion.class))).thenReturn(saved);
            when(voteRepository.existsBySuggestionIdAndUserId(any(), any())).thenReturn(false);

            SuggestionResponse resultado = suggestionService.create(1L, "Nueva función", "Detalles");

            ArgumentCaptor<Suggestion> captor = ArgumentCaptor.forClass(Suggestion.class);
            verify(suggestionRepository).save(captor.capture());
            assertThat(captor.getValue().getTitle()).isEqualTo("Nueva función");
            assertThat(captor.getValue().getUser()).isEqualTo(user);
        }

        @Test
        void tituloVacioLanzaBusinessException() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(buildUser(1L)));

            assertThatThrownBy(() -> suggestionService.create(1L, "  ", "Descripción"))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("título");

            verify(suggestionRepository, never()).save(any());
        }

        @Test
        void tituloNullLanzaBusinessException() {
            when(userRepository.findById(1L)).thenReturn(Optional.of(buildUser(1L)));

            assertThatThrownBy(() -> suggestionService.create(1L, null, "Descripción"))
                    .isInstanceOf(BusinessException.class);

            verify(suggestionRepository, never()).save(any());
        }

        @Test
        void usuarioNoEncontradoLanzaResourceNotFoundException() {
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> suggestionService.create(99L, "Título", "Desc"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("User not found");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class Vote {

        @Test
        void votoNuevoIncrementaContador() {
            Suggestion suggestion = buildSuggestion(1L, 5);
            User user = buildUser(2L);
            when(suggestionRepository.findById(1L)).thenReturn(Optional.of(suggestion));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user));
            // First call: check if already voted (false) → vote branch. Second call: mapSuggestion hasVoted (true).
            when(voteRepository.existsBySuggestionIdAndUserId(1L, 2L)).thenReturn(false, true);
            when(suggestionRepository.save(suggestion)).thenReturn(suggestion);

            SuggestionResponse resultado = suggestionService.vote(1L, 2L);

            assertThat(suggestion.getVoteCount()).isEqualTo(6);
            verify(voteRepository).save(any(SuggestionVote.class));
        }

        @Test
        void votarDosVecesEliminaElVoto() {
            Suggestion suggestion = buildSuggestion(1L, 3);
            User user = buildUser(2L);
            SuggestionVote voto = SuggestionVote.builder().id(1L).suggestion(suggestion).user(user).build();
            when(suggestionRepository.findById(1L)).thenReturn(Optional.of(suggestion));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user));
            // First call: check if already voted (true) → unvote branch. Second call: mapSuggestion hasVoted (false).
            when(voteRepository.existsBySuggestionIdAndUserId(1L, 2L)).thenReturn(true, false);
            when(voteRepository.findBySuggestionIdAndUserId(1L, 2L)).thenReturn(Optional.of(voto));
            when(suggestionRepository.save(suggestion)).thenReturn(suggestion);

            suggestionService.vote(1L, 2L);

            assertThat(suggestion.getVoteCount()).isEqualTo(2);
            verify(voteRepository).delete(voto);
        }

        @Test
        void voteCountNoBajaDecerodAlDesvotar() {
            Suggestion suggestion = buildSuggestion(1L, 0);
            User user = buildUser(2L);
            SuggestionVote voto = SuggestionVote.builder().id(1L).suggestion(suggestion).user(user).build();
            when(suggestionRepository.findById(1L)).thenReturn(Optional.of(suggestion));
            when(userRepository.findById(2L)).thenReturn(Optional.of(user));
            when(voteRepository.existsBySuggestionIdAndUserId(1L, 2L)).thenReturn(true, false);
            when(voteRepository.findBySuggestionIdAndUserId(1L, 2L)).thenReturn(Optional.of(voto));
            when(suggestionRepository.save(suggestion)).thenReturn(suggestion);

            suggestionService.vote(1L, 2L);

            assertThat(suggestion.getVoteCount()).isGreaterThanOrEqualTo(0);
        }

        @Test
        void sugerenciaNoEncontradaLanzaResourceNotFoundException() {
            when(suggestionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> suggestionService.vote(99L, 1L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Suggestion not found");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class AnswerSuggestion {

        @Test
        void respondeSugerenciaYActualizaStatus() {
            Suggestion suggestion = buildSuggestion(1L, 0);
            User admin = buildUser(99L);
            when(suggestionRepository.findById(1L)).thenReturn(Optional.of(suggestion));
            when(userRepository.findById(99L)).thenReturn(Optional.of(admin));
            when(suggestionRepository.save(suggestion)).thenReturn(suggestion);

            suggestionService.answerSuggestion(1L, 99L, "Excelente idea, lo vamos a implementar", "PLANNED");

            assertThat(suggestion.getAnswer()).isEqualTo("Excelente idea, lo vamos a implementar");
            assertThat(suggestion.getAnsweredBy()).isEqualTo(admin);
            assertThat(suggestion.getAnsweredAt()).isNotNull();
            assertThat(suggestion.getStatus()).isEqualTo("PLANNED");
        }

        @Test
        void sugerenciaNoEncontradaLanzaResourceNotFoundException() {
            when(suggestionRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> suggestionService.answerSuggestion(99L, 1L, "Respuesta", null))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Suggestion not found");
        }
    }
}
