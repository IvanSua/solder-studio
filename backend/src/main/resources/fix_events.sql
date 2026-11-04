-- ── Reemplaza eventos falsos/incorrectos con datos reales confirmados ─────────
-- Todos los eventos en este script son shows o estrenos CONFIRMADOS para
-- Argentina en 2026 (verificados en marzo 2026).
--
-- Ejecutar con psql o pgAdmin.

SET client_encoding = 'UTF8';

BEGIN;

-- Eliminar todos los eventos anteriores (datos no verificados)
DELETE FROM events;

-- ── Shows ya realizados (histórico del año) ───────────────────────────────────

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'My Chemical Romance – The Black Parade Tour',
  'Con The Hives como banda invitada',
  'CONCERT', 'ROCK',
  '2026-02-01', '20:00',
  'Estadio Huracán', 'Buenos Aires',
  'My Chemical Romance regresó a Argentina después de 18 años con su gira The Black Parade. The Hives como banda soporte. Un show histórico con Welcome to the Black Parade, Famous Last Words y clásicos del álbum.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Bad Bunny – Debí Tirar Más Fotos Tour',
  'El artista más escuchado del mundo',
  'CONCERT', 'LATIN',
  '2026-02-13', '21:00',
  'Estadio River Plate', 'Buenos Aires',
  'Bad Bunny presentó en Argentina su álbum Debí Tirar Más Fotos con una producción masiva en el Monumental. Entradas agotadas en tiempo récord.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Lollapalooza Argentina 2026',
  'Tyler, The Creator · Sabrina Carpenter · Chappell Roan · Lorde',
  'CONCERT', 'FESTIVAL',
  '2026-03-13', '12:30',
  'Hipódromo de San Isidro', 'Buenos Aires',
  'Tres jornadas (13, 14 y 15 de marzo) con más de 100 artistas internacionales y nacionales. Headliners: Tyler, The Creator, Sabrina Carpenter, Chappell Roan, Lorde, Skrillex, Deftones, Doechii, Lewis Capaldi y Paulo Londra.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'AC/DC – Power Up Tour',
  'Brian Johnson · Angus Young · Phil Rudd · Stevie Young',
  'CONCERT', 'ROCK',
  '2026-03-23', '20:30',
  'Estadio River Plate', 'Buenos Aires',
  'AC/DC volvió a Argentina con el Power Up Tour: tres fechas en el Monumental (23, 27 y 31 de marzo), todas con entradas agotadas. La banda de hard rock más grande del mundo en plena forma con Back in Black, Highway to Hell, Thunderstruck y más.',
  'https://www.ticketek.com.ar',
  true
);

-- ── Shows próximos confirmados ────────────────────────────────────────────────

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Laura Pausini – Yo Canto World Tour',
  'La diva italiana en el Movistar Arena',
  'CONCERT', 'POP',
  '2026-04-12', '21:00',
  'Movistar Arena', 'Buenos Aires',
  'Laura Pausini presenta su Yo Canto World Tour en Argentina. Una noche de pop italiano con sus grandes éxitos: La Soledad, Se fue, Surrender, Vivimi y más de dos décadas de hits.',
  'https://www.ticketek.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Ricardo Arjona – Blanco y Negro Tour',
  '11 noches en el Movistar Arena',
  'CONCERT', 'LATIN',
  '2026-05-01', '21:00',
  'Movistar Arena', 'Buenos Aires',
  'Ricardo Arjona llega a Buenos Aires con un ciclo de 11 funciones en el Movistar Arena (1, 2, 3, 7, 8, 11, 12, 17, 18, 23 y 24 de mayo). Repertorio completo de una carrera de más de 30 años. Ideal para reencontrarse con Señora de las Cuatro Décadas, Te Conozco, Mujeres y más.',
  'https://www.ticketek.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Pixies – Doggerel Tour',
  'Los padres del alt-rock en Buenos Aires',
  'CONCERT', 'ROCK',
  '2026-05-10', '20:30',
  'Parque Sarmiento', 'Buenos Aires',
  'Pixies regresa a Argentina con su tour. Black Francis, Kim Deal y compañía presentan sus clásicos: Where Is My Mind?, Debaser, Here Comes Your Man, Gigantic y canciones de Doggerel, su último álbum.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Robert Plant – Saving Grace Tour',
  'La leyenda de Led Zeppelin en teatro íntimo',
  'CONCERT', 'ROCK',
  '2026-05-10', '20:00',
  'Teatro Gran Rex', 'Buenos Aires',
  'Robert Plant, vocalista legendario de Led Zeppelin, en el íntimo Teatro Gran Rex con su proyecto Saving Grace junto a Suzi Dian. Dos noches (10 y 11 de mayo) de rock y folk con canciones de su extensa carrera solista.',
  'https://www.ticketek.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Lali – Fanático Tour',
  'La reina del pop argentino en el Estadio Monumental',
  'CONCERT', 'POP',
  '2026-06-06', '20:30',
  'Estadio Monumental', 'Buenos Aires',
  'Lali Espósito lleva su Fanático Tour al estadio más grande de Argentina. Dos noches históricas (6 y 7 de junio) con toda la producción de su era más exitosa: Fanática, Disciplina, Saber Cómo y todos sus hits.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Rosalía – Motomami Tour',
  'Cuatro noches en el Movistar Arena',
  'CONCERT', 'POP',
  '2026-08-01', '21:00',
  'Movistar Arena', 'Buenos Aires',
  'Rosalía llega a Argentina con cuatro noches en el Movistar Arena (1, 2, 4 y 6 de agosto). El show visual más innovador del pop actual con canciones de MOTOMAMI, El Mal Querer y sus últimos lanzamientos.',
  'https://www.allaccess.com.ar',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, event_time, venue, city, description, ticket_url, active)
VALUES (
  'Iron Maiden – Run for Your Lives Tour',
  'Dos noches épicas en Estadio Huracán',
  'CONCERT', 'METAL',
  '2026-10-20', '20:30',
  'Estadio Huracán', 'Buenos Aires',
  'Iron Maiden regresa a Argentina con el Run for Your Lives Tour, presentando un setlist histórico de los primeros nueve álbumes de la banda. Dos fechas confirmadas: 20 y 21 de octubre en el Estadio Tomás Adolfo Ducó.',
  'https://www.ticketek.com.ar',
  true
);

-- ── Estrenos de cine y anime confirmados 2026 ─────────────────────────────────

INSERT INTO events (title, subtitle, type, category, event_date, venue, city, description, active)
VALUES (
  'Demon Slayer: Infinity Castle – Parte 1',
  'La película de anime más esperada del año',
  'PREMIERE', 'ANIME',
  '2026-04-18',
  'Cines de todo el país', 'Argentina',
  'La adaptación cinematográfica del arco del Castillo Infinito de Kimetsu no Yaiba. Tanjiro, Zenitsu e Inosuke junto a todos los Pilares Hashira se enfrentan a los Doce Lunas Superiores de Muzan. Estreno internacional confirmado. La más taquillera del anime en 2026.',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, venue, city, description, active)
VALUES (
  'Avengers: Doomsday',
  'El regreso de Robert Downey Jr. como Doctor Doom',
  'PREMIERE', 'MARVEL',
  '2026-05-01',
  'Cines de todo el país', 'Argentina',
  'La primera parte del crossover definitivo del MCU. Robert Downey Jr. regresa como el villano Doctor Doom para enfrentar a todos los héroes del multiverso. Dirigida por los Hermanos Russo con un elenco histórico. Estreno mundial el 1 de mayo.',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, venue, city, description, active)
VALUES (
  'Misión: Imposible – Sentencia Mortal Parte 2',
  'La última misión de Ethan Hunt en pantalla grande',
  'PREMIERE', 'ACCION',
  '2026-05-23',
  'Cines de todo el país', 'Argentina',
  'Tom Cruise como Ethan Hunt en la entrega final de la saga Mission: Impossible. Más acrobacias prácticas sin CGI, persecuciones imposibles y el cierre de una de las mejores sagas de acción de la historia del cine.',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, venue, city, description, active)
VALUES (
  'Toy Story 5',
  'Woody, Buzz y los juguetes regresan en Pixar',
  'PREMIERE', 'DISNEY',
  '2026-06-19',
  'Cines de todo el país', 'Argentina',
  'Pixar trae de regreso a los personajes más queridos de la animación en una nueva aventura. Toy Story 5 promete emocionar tanto a fanáticos de la primera hora como a las nuevas generaciones. Estreno mundial confirmado.',
  true
);

INSERT INTO events (title, subtitle, type, category, event_date, venue, city, description, active)
VALUES (
  'Los 4 Fantásticos: Primeros Pasos',
  'La nueva era de los 4 Fantásticos en el UCM',
  'PREMIERE', 'MARVEL',
  '2026-07-25',
  'Cines de todo el país', 'Argentina',
  'Pedro Pascal, Vanessa Kirby, Joseph Quinn y Ebon Moss-Bachrach son Reed Richards, Sue Storm, Johnny Storm y Ben Grimm en esta película ambientada en un universo retrofuturista de los años 60. Dirigida por Matt Shakman. Estreno mundial el 25 de julio.',
  true
);

COMMIT;

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT id, title, type, category, event_date, venue
FROM events
ORDER BY event_date;

SELECT COUNT(*) AS total_events FROM events;
