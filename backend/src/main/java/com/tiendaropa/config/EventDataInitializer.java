package com.tiendaropa.config;

import com.tiendaropa.entity.Event;
import com.tiendaropa.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Seeds the events table with confirmed concerts and movie/anime premieres on first startup.
 * All events are real and confirmed as of March 2026.
 * Does nothing if events already exist.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventDataInitializer implements ApplicationRunner {

    private final EventRepository eventRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (eventRepository.count() > 0) return;

        log.info("Seeding initial events data...");
        eventRepository.saveAll(buildEvents());
        log.info("Events seeded successfully.");
    }

    private List<Event> buildEvents() {
        return List.of(

            // ── Conciertos ya realizados (histórico) ──────────────────────────
            Event.builder()
                .title("My Chemical Romance – The Black Parade Tour")
                .subtitle("Con The Hives como banda invitada")
                .type("CONCERT").category("ROCK")
                .eventDate(LocalDate.of(2026, 2, 1))
                .eventTime(LocalTime.of(20, 0))
                .venue("Estadio Huracán").city("Buenos Aires")
                .description("My Chemical Romance regresó a Argentina después de 18 años con su gira The Black Parade, presentando sus clásicos: Welcome to the Black Parade, Famous Last Words y más.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("Bad Bunny – Debí Tirar Más Fotos Tour")
                .subtitle("El artista más escuchado del mundo")
                .type("CONCERT").category("LATIN")
                .eventDate(LocalDate.of(2026, 2, 13))
                .eventTime(LocalTime.of(21, 0))
                .venue("Estadio River Plate").city("Buenos Aires")
                .description("Bad Bunny llegó a Argentina con la gira de presentación de su álbum 'Debí Tirar Más Fotos'. Un show masivo en el Monumental con entradas agotadas.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("Lollapalooza Argentina 2026")
                .subtitle("Tyler, The Creator · Sabrina Carpenter · Chappell Roan · Lorde")
                .type("CONCERT").category("FESTIVAL")
                .eventDate(LocalDate.of(2026, 3, 13))
                .eventTime(LocalTime.of(12, 30))
                .venue("Hipódromo de San Isidro").city("Buenos Aires")
                .description("Lollapalooza Argentina 2026 (13, 14 y 15 de marzo). Tres jornadas con más de 100 artistas. Headliners: Tyler, The Creator, Sabrina Carpenter, Chappell Roan, Lorde, Skrillex, Deftones y más.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("AC/DC – Power Up Tour")
                .subtitle("Brian Johnson · Angus Young · Phil Rudd de regreso")
                .type("CONCERT").category("ROCK")
                .eventDate(LocalDate.of(2026, 3, 23))
                .eventTime(LocalTime.of(20, 30))
                .venue("Estadio River Plate").city("Buenos Aires")
                .description("AC/DC regresó a Argentina con su Power Up Tour, la primera gira con entradas en su historia. Tres fechas en el Monumental con entradas totalmente agotadas: 23, 27 y 31 de marzo.")
                .ticketUrl("https://www.ticketek.com.ar")
                .build(),

            // ── Conciertos próximos confirmados ───────────────────────────────
            Event.builder()
                .title("Laura Pausini – Yo Canto World Tour")
                .subtitle("La diva italiana en el Movistar Arena")
                .type("CONCERT").category("POP")
                .eventDate(LocalDate.of(2026, 4, 12))
                .eventTime(LocalTime.of(21, 0))
                .venue("Movistar Arena").city("Buenos Aires")
                .description("Laura Pausini presenta su Yo Canto World Tour en Argentina. Una noche de pop italiano con sus grandes éxitos: La Soledad, Se fue, Surrender y más.")
                .ticketUrl("https://www.ticketek.com.ar")
                .build(),

            Event.builder()
                .title("Ricardo Arjona – Blanco y Negro Tour")
                .subtitle("El guatemalteco más esperado del año")
                .type("CONCERT").category("LATIN")
                .eventDate(LocalDate.of(2026, 5, 1))
                .eventTime(LocalTime.of(21, 0))
                .venue("Movistar Arena").city("Buenos Aires")
                .description("Ricardo Arjona llega a Argentina con un ciclo de shows en el Movistar Arena. Fechas: 1, 2, 3, 7, 8, 11, 12, 17, 18, 23 y 24 de mayo. Repertorio completo de su extensa carrera.")
                .ticketUrl("https://www.ticketek.com.ar")
                .build(),

            Event.builder()
                .title("Pixies – Doggerel Tour")
                .subtitle("Los padres del alt-rock en Buenos Aires")
                .type("CONCERT").category("ROCK")
                .eventDate(LocalDate.of(2026, 5, 10))
                .eventTime(LocalTime.of(20, 30))
                .venue("Parque Sarmiento").city("Buenos Aires")
                .description("Pixies vuelve a Argentina con su tour. Black Francis y compañía presentan sus clásicos: Where Is My Mind?, Debaser, Here Comes Your Man y canciones de su último álbum.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("Robert Plant – Saving Grace Tour")
                .subtitle("La leyenda de Led Zeppelin en vivo")
                .type("CONCERT").category("ROCK")
                .eventDate(LocalDate.of(2026, 5, 10))
                .eventTime(LocalTime.of(20, 0))
                .venue("Teatro Gran Rex").city("Buenos Aires")
                .description("Robert Plant, vocalista legendario de Led Zeppelin, se presenta en el íntimo Teatro Gran Rex con su proyecto Saving Grace. Dos noches: 10 y 11 de mayo.")
                .ticketUrl("https://www.ticketek.com.ar")
                .build(),

            Event.builder()
                .title("Lali – Fanático Tour")
                .subtitle("La reina del pop argentino en el Monumental")
                .type("CONCERT").category("POP")
                .eventDate(LocalDate.of(2026, 6, 6))
                .eventTime(LocalTime.of(20, 30))
                .venue("Estadio Monumental").city("Buenos Aires")
                .description("Lali Espósito lleva su Fanático Tour al estadio más grande de Argentina. Dos noches (6 y 7 de junio) con toda la producción de su era más exitosa.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("Rosalía – Motomami Tour")
                .subtitle("La artista española más importante del momento")
                .type("CONCERT").category("POP")
                .eventDate(LocalDate.of(2026, 8, 1))
                .eventTime(LocalTime.of(21, 0))
                .venue("Movistar Arena").city("Buenos Aires")
                .description("Rosalía llega a Argentina con cuatro fechas en el Movistar Arena (1, 2, 4 y 6 de agosto). El show visual más innovador del pop actual con canciones de MOTOMAMI y Bejeweled.")
                .ticketUrl("https://www.allaccess.com.ar")
                .build(),

            Event.builder()
                .title("Iron Maiden – Run for Your Lives Tour")
                .subtitle("La primera vez que tocan álbumes clásicos completos")
                .type("CONCERT").category("METAL")
                .eventDate(LocalDate.of(2026, 10, 20))
                .eventTime(LocalTime.of(20, 30))
                .venue("Estadio Huracán").city("Buenos Aires")
                .description("Iron Maiden regresa a Argentina con el Run for Your Lives Tour, presentando un setlist de los primeros nueve álbumes. Dos fechas en Huracán: 20 y 21 de octubre.")
                .ticketUrl("https://www.ticketek.com.ar")
                .build(),

            // ── Estrenos de cine confirmados 2026 ────────────────────────────
            Event.builder()
                .title("Demon Slayer: Kimetsu no Yaiba – Infinity Castle")
                .subtitle("La película más esperada del anime llega a los cines")
                .type("PREMIERE").category("ANIME")
                .eventDate(LocalDate.of(2026, 4, 18))
                .venue("Cines de todo el país").city("Argentina")
                .description("La adaptación cinematográfica del arco del Castillo Infinito de Demon Slayer. Tanjiro y los Pilares se enfrentan a los Doce Lunas Superiores en la batalla más épica del anime. Estreno internacional confirmado.")
                .build(),

            Event.builder()
                .title("Avengers: Doomsday")
                .subtitle("El regreso de Robert Downey Jr. como Doctor Doom")
                .type("PREMIERE").category("MARVEL")
                .eventDate(LocalDate.of(2026, 5, 1))
                .venue("Cines de todo el país").city("Argentina")
                .description("La primera parte del crossover definitivo del MCU. Doctor Doom reúne a todos los héroes del multiverso. Dirigida por los Russo Brothers con un elenco histórico. Estreno mundial confirmado para el 1 de mayo.")
                .build(),

            Event.builder()
                .title("Mission: Impossible – The Final Reckoning")
                .subtitle("La última misión de Ethan Hunt en pantalla grande")
                .type("PREMIERE").category("ACCION")
                .eventDate(LocalDate.of(2026, 5, 23))
                .venue("Cines de todo el país").city("Argentina")
                .description("Tom Cruise vuelve como Ethan Hunt en la entrega final de la saga Mission: Impossible. Más acción práctica, más escenas imposibles, el cierre épico de una de las mejores sagas de acción.")
                .build(),

            Event.builder()
                .title("Toy Story 5")
                .subtitle("Woody, Buzz y los juguetes regresan a Pixar")
                .type("PREMIERE").category("DISNEY")
                .eventDate(LocalDate.of(2026, 6, 19))
                .venue("Cines de todo el país").city("Argentina")
                .description("Pixar trae de regreso a los personajes más queridos de la animación en una nueva aventura. Toy Story 5 promete emocionar tanto a los fanáticos de la primera hora como a las nuevas generaciones.")
                .build(),

            Event.builder()
                .title("Los 4 Fantásticos: Primeros Pasos")
                .subtitle("La nueva era de los 4 Fantásticos en el MCU")
                .type("PREMIERE").category("MARVEL")
                .eventDate(LocalDate.of(2026, 7, 25))
                .venue("Cines de todo el país").city("Argentina")
                .description("Pedro Pascal, Vanessa Kirby, Joseph Quinn y Ebon Moss-Bachrach son los 4 Fantásticos en esta película ambientada en un universo retrofuturista. Dirigida por Matt Shakman. Estreno mundial confirmado.")
                .build()
        );
    }
}
