package com.tiendaropa.repository;

import com.tiendaropa.entity.Event;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {

    /** All active events from a given date onward */
    List<Event> findByActiveTrueAndEventDateGreaterThanEqualOrderByEventDateAsc(LocalDate from);

    /** Active events within a month range (inclusive) */
    @Query("SELECT e FROM Event e WHERE e.active = true AND e.eventDate BETWEEN :from AND :to ORDER BY e.eventDate ASC")
    List<Event> findActiveInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** All events (admin) sorted by date */
    List<Event> findAll(Sort sort);

    /** Events on a specific date — used for deduplication during import */
    List<Event> findByEventDate(LocalDate eventDate);
}
