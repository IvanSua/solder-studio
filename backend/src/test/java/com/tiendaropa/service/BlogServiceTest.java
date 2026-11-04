package com.tiendaropa.service;

import com.tiendaropa.dto.request.BlogPostRequest;
import com.tiendaropa.dto.response.BlogPostResponse;
import com.tiendaropa.entity.BlogPost;
import com.tiendaropa.exception.ResourceNotFoundException;
import com.tiendaropa.repository.BlogPostRepository;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BlogServiceTest {

    @Mock
    private BlogPostRepository blogPostRepository;

    @InjectMocks
    private BlogService blogService;

    private BlogPost buildPost(Long id, String slug, boolean published, boolean featured) {
        return BlogPost.builder()
                .id(id)
                .title("Test Post " + id)
                .slug(slug)
                .excerpt("Resumen del post")
                .content("Contenido completo del post")
                .author("Autor Test")
                .category("moda")
                .published(published)
                .featured(featured)
                .publishedAt(published ? Instant.now() : null)
                .build();
    }

    private BlogPostRequest buildRequest(boolean published, boolean featured) {
        return BlogPostRequest.builder()
                .title("Nuevo Post")
                .content("Contenido del post")
                .excerpt("Resumen")
                .author("Autor")
                .category("moda")
                .published(published)
                .featured(featured)
                .build();
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class GetPublishedPosts {

        @Test
        void retornaPostsPublicadosOrdenadosPorFecha() {
            BlogPost post1 = buildPost(1L, "post-1", true, false);
            BlogPost post2 = buildPost(2L, "post-2", true, true);
            Page<BlogPost> page = new PageImpl<>(List.of(post1, post2));
            when(blogPostRepository.findByPublishedTrueOrderByPublishedAtDesc(any())).thenReturn(page);

            Page<BlogPostResponse> resultado = blogService.getPublishedPosts(0, 10);

            assertThat(resultado.getContent()).hasSize(2);
            assertThat(resultado.getContent().get(0).getSlug()).isEqualTo("post-1");
        }

        @Test
        void retornaPaginaVaciaSinPosts() {
            when(blogPostRepository.findByPublishedTrueOrderByPublishedAtDesc(any()))
                    .thenReturn(Page.empty());

            Page<BlogPostResponse> resultado = blogService.getPublishedPosts(0, 10);

            assertThat(resultado.getContent()).isEmpty();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class GetPostBySlug {

        @Test
        void retornaPostPublicadoPorSlug() {
            BlogPost post = buildPost(1L, "mi-post", true, false);
            when(blogPostRepository.findBySlug("mi-post")).thenReturn(Optional.of(post));

            BlogPostResponse resultado = blogService.getPostBySlug("mi-post");

            assertThat(resultado.getSlug()).isEqualTo("mi-post");
            assertThat(resultado.isPublished()).isTrue();
        }

        @Test
        void postNoEncontradoLanzaResourceNotFoundException() {
            when(blogPostRepository.findBySlug("no-existe")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> blogService.getPostBySlug("no-existe"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Post not found");
        }

        @Test
        void postNoPublicadoLanzaResourceNotFoundException() {
            BlogPost post = buildPost(1L, "borrador", false, false);
            when(blogPostRepository.findBySlug("borrador")).thenReturn(Optional.of(post));

            assertThatThrownBy(() -> blogService.getPostBySlug("borrador"))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Post not found");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class CreatePost {

        @Test
        void creaPostConSlugGeneradoDesdeElTitulo() {
            BlogPostRequest req = buildRequest(true, false);
            req = BlogPostRequest.builder()
                    .title("Mi Primer Post")
                    .content("Contenido")
                    .excerpt("Resumen")
                    .author("Autor")
                    .category("moda")
                    .published(true)
                    .build();

            when(blogPostRepository.existsBySlug(any())).thenReturn(false);
            BlogPost saved = buildPost(1L, "mi-primer-post", true, false);
            when(blogPostRepository.save(any(BlogPost.class))).thenReturn(saved);

            BlogPostResponse resultado = blogService.createPost(req);

            assertThat(resultado.getId()).isEqualTo(1L);
            ArgumentCaptor<BlogPost> captor = ArgumentCaptor.forClass(BlogPost.class);
            verify(blogPostRepository).save(captor.capture());
            assertThat(captor.getValue().getSlug()).isEqualTo("mi-primer-post");
        }

        @Test
        void postPublicadoTienePublishedAt() {
            BlogPostRequest req = buildRequest(true, false);
            when(blogPostRepository.existsBySlug(any())).thenReturn(false);
            BlogPost saved = buildPost(1L, "nuevo-post", true, false);
            when(blogPostRepository.save(any(BlogPost.class))).thenReturn(saved);

            blogService.createPost(req);

            ArgumentCaptor<BlogPost> captor = ArgumentCaptor.forClass(BlogPost.class);
            verify(blogPostRepository).save(captor.capture());
            assertThat(captor.getValue().getPublishedAt()).isNotNull();
        }

        @Test
        void postNoPUblicadoNoTienePublishedAt() {
            BlogPostRequest req = buildRequest(false, false);
            when(blogPostRepository.existsBySlug(any())).thenReturn(false);
            BlogPost saved = buildPost(1L, "borrador", false, false);
            when(blogPostRepository.save(any(BlogPost.class))).thenReturn(saved);

            blogService.createPost(req);

            ArgumentCaptor<BlogPost> captor = ArgumentCaptor.forClass(BlogPost.class);
            verify(blogPostRepository).save(captor.capture());
            assertThat(captor.getValue().getPublishedAt()).isNull();
        }

        @Test
        void slugDuplicadoAgregarSufijo() {
            BlogPostRequest req = buildRequest(false, false);
            // First call returns true (slug exists), second returns false
            when(blogPostRepository.existsBySlug("nuevo-post")).thenReturn(true);
            when(blogPostRepository.existsBySlug("nuevo-post-1")).thenReturn(false);
            BlogPost saved = buildPost(1L, "nuevo-post-1", false, false);
            when(blogPostRepository.save(any(BlogPost.class))).thenReturn(saved);

            blogService.createPost(req);

            ArgumentCaptor<BlogPost> captor = ArgumentCaptor.forClass(BlogPost.class);
            verify(blogPostRepository).save(captor.capture());
            assertThat(captor.getValue().getSlug()).isEqualTo("nuevo-post-1");
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class UpdatePost {

        @Test
        void actualizaPostExistente() {
            BlogPost post = buildPost(1L, "post-existente", false, false);
            when(blogPostRepository.findById(1L)).thenReturn(Optional.of(post));
            when(blogPostRepository.save(post)).thenReturn(post);

            BlogPostRequest req = buildRequest(true, true);
            blogService.updatePost(1L, req);

            assertThat(post.isPublished()).isTrue();
            assertThat(post.isFeatured()).isTrue();
            assertThat(post.getPublishedAt()).isNotNull();
            verify(blogPostRepository).save(post);
        }

        @Test
        void postNoEncontradoLanzaResourceNotFoundException() {
            when(blogPostRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> blogService.updatePost(99L, buildRequest(false, false)))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Post not found");
        }

        @Test
        void publicadAtNoSeSobreescribeSiYaExiste() {
            BlogPost post = buildPost(1L, "ya-publicado", true, false);
            Instant publishedAt = post.getPublishedAt();
            when(blogPostRepository.findById(1L)).thenReturn(Optional.of(post));
            when(blogPostRepository.save(post)).thenReturn(post);

            blogService.updatePost(1L, buildRequest(true, false));

            // publishedAt should remain the same
            assertThat(post.getPublishedAt()).isEqualTo(publishedAt);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    @Nested
    class DeletePost {

        @Test
        void eliminaPostExistente() {
            when(blogPostRepository.existsById(1L)).thenReturn(true);

            blogService.deletePost(1L);

            verify(blogPostRepository).deleteById(1L);
        }

        @Test
        void postNoEncontradoLanzaResourceNotFoundException() {
            when(blogPostRepository.existsById(99L)).thenReturn(false);

            assertThatThrownBy(() -> blogService.deletePost(99L))
                    .isInstanceOf(ResourceNotFoundException.class)
                    .hasMessageContaining("Post not found");

            verify(blogPostRepository, never()).deleteById(any());
        }
    }
}
