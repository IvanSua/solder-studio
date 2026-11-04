package com.tiendaropa.repository;

import com.tiendaropa.entity.NewsletterSubscriber;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NewsletterRepository extends JpaRepository<NewsletterSubscriber, Long> {

    boolean existsByEmail(String email);

    Optional<NewsletterSubscriber> findByEmail(String email);

    Page<NewsletterSubscriber> findByActiveOrderBySubscribedAtDesc(boolean active, Pageable pageable);

    List<NewsletterSubscriber> findAllByActiveTrue();

    long countByActive(boolean active);
}
