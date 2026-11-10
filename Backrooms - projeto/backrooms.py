# -*- coding: cp1252 -*-
# pyright: reportUndefinedVariable=false
# pgzero
from pgzero.builtins import *
from collections import deque

TITLE = "Backrooms: Fuga no Labirinto"
WIDTH = 900
HEIGHT = 720

state = "menu"  # menu | game | gameover | victory
selected_character = "runner"
current_level = 0

CHARACTERS = {
    "runner": {
        "name": "Elliot",
        "gender": "MENINO",
        "subtitle": "rápido e evasivo",
        "color": (110, 220, 140),
    },
    "guardian": {
        "name": "Luigi",
        "gender": "MENINO",
        "subtitle": "forte e resistente",
        "color": (120, 170, 255),
    },
    "ghost": {
        "name": "Nixie",
        "gender": "MENINA",
        "subtitle": "silencioso e furtivo",
        "color": (255, 190, 110),
    },
    "scout": {
        "name": "Yunah",
        "gender": "MENINA",
        "subtitle": "inteligente e observadora",
        "color": (220, 135, 205),
    },
}

MONSTERS = [
    {"name": "Rastejante", "color": (143, 190, 94), "image": "monster_crawler"},
    {"name": "Chifrudo", "color": (184, 83, 58), "image": "monster_horned"},
    {"name": "Brutamontes", "color": (104, 100, 145), "image": "monster_brute"},
    {"name": "Aparição", "color": (102, 190, 190), "image": "monster_wraith"},
]


def build_level(vertical_gaps, horizontal_gaps):
    level = [[0 for _ in range(20)] for _ in range(12)]

    for x in range(20):
        level[0][x] = 1
        level[11][x] = 1
    for y in range(12):
        level[y][0] = 1
        level[y][19] = 1

    for x, gaps in vertical_gaps.items():
        for y in range(1, 11):
            if y not in gaps:
                level[y][x] = 1

    for y, gaps in horizontal_gaps.items():
        for x in range(1, 19):
            if x not in gaps:
                level[y][x] = 1

    level[10][18] = 2
    return level


LEVELS = [
    build_level(
        {5: (2, 8), 12: (3, 9)},
        {4: (3, 10, 16), 8: (2, 9, 15)},
    ),
    build_level(
        {5: (4, 9), 9: (2, 6, 9), 12: (2, 7)},
        {4: (4, 5, 6, 14), 7: (3, 10, 16), 8: (4, 11, 17)},
    ),
    build_level(
        {4: (2, 6, 9), 8: (3, 7), 12: (5, 9), 16: (2, 6, 9)},
        {3: (3, 9, 15), 6: (2, 7, 12, 17), 8: (5, 10, 16)},
    ),
    build_level(
        {4: (2, 6, 9), 8: (3, 7), 12: (2, 6, 9), 16: (4, 8)},
        {3: (3, 9, 15), 5: (5, 11, 17), 7: (2, 8, 14), 9: (5, 10, 14)},
    ),
]

cw = WIDTH // len(LEVELS[0][0])
ch = HEIGHT // len(LEVELS[0])

player = Actor("runner_front")
player.grid_x = 1
player.grid_y = 1

enemies = [Actor("monster_crawler") for _ in range(4)]
enemy_positions_by_level = [
    [(17, 2)],
    [(17, 2), (17, 9)],
    [(17, 2), (17, 9), (2, 10)],
    [(17, 2), (17, 9), (2, 10), (10, 1)],
]


def connect_level_target(level, target):
    reachable = {(1, 1)}
    queue = deque([(1, 1)])
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 1 <= nx < 19 and 1 <= ny < 11 and level[ny][nx] != 1 and (nx, ny) not in reachable:
                reachable.add((nx, ny))
                queue.append((nx, ny))

    parents = {target: None}
    queue = deque([target])
    connection = None
    while queue:
        x, y = queue.popleft()
        if (x, y) in reachable:
            connection = (x, y)
            break
        for next_pos in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            nx, ny = next_pos
            if 1 <= nx < 19 and 1 <= ny < 11 and next_pos not in parents:
                parents[next_pos] = (x, y)
                queue.append(next_pos)

    while connection is not None:
        x, y = connection
        if (x, y) != (18, 10):
            level[y][x] = 0
        connection = parents[connection]


for level in LEVELS:
    connect_level_target(level, (18, 10))
for level, positions in zip(LEVELS, enemy_positions_by_level):
    for position in positions:
        connect_level_target(level, position)
    level[10][18] = 2

enemy_move_intervals = [0.95, 0.75, 0.58, 0.43]
player_move_interval = 0.14
player_move_timer = 0
enemy_move_timer = 0
active_enemies = []

play_btn = Rect((300, 530), (300, 70))
char_cards = [
    Rect((50, 235), (190, 230)),
    Rect((260, 235), (190, 230)),
    Rect((470, 235), (190, 230)),
    Rect((680, 235), (190, 230)),
]


def load_level(index):
    global mapa, active_enemies, player_move_timer, enemy_move_timer
    mapa = LEVELS[index]
    player.grid_x, player.grid_y = 1, 1
    player_move_timer = 0
    enemy_move_timer = 0
    active_enemies = enemies[: index + 1]

    for enemy, (x, y) in zip(active_enemies, enemy_positions_by_level[index]):
        enemy.grid_x = x
        enemy.grid_y = y
        enemy.image = MONSTERS[index]["image"]

    player.image = f"{selected_character}_front"


def reset_game():
    global state, current_level
    current_level = 0
    load_level(current_level)
    state = "game"


def draw_outline(rect, color, width=1):
    for inset in range(width):
        screen.draw.rect(
            Rect((rect.x + inset, rect.y + inset), (rect.w - 2 * inset, rect.h - 2 * inset)),
            color,
        )


def draw_menu():
    screen.fill((15, 17, 16))
    for x in range(0, WIDTH, 90):
        screen.draw.filled_rect(Rect((x, 0), (45, HEIGHT)), (17, 20, 18))

    screen.draw.filled_rect(Rect((24, 20), (852, 680)), (24, 27, 24))
    draw_outline(Rect((24, 20), (852, 680)), (91, 103, 55), 2)
    screen.draw.text("ARQUIVO  01  /  SETOR DESCONHECIDO", (58, 48), fontsize=16, color=(176, 183, 142))
    screen.draw.text("BACKROOMS", center=(WIDTH // 2, 112), fontsize=58, color=(232, 214, 121))
    screen.draw.text(
        "FUJA DO LABIRINTO. NAO OLHE PARA TRAS.",
        center=(WIDTH // 2, 170),
        fontsize=20,
        color=(204, 207, 190),
    )
    screen.draw.text(
        "ESCOLHA SEU PERSONAGEM",
        center=(WIDTH // 2, 208),
        fontsize=18,
        color=(176, 183, 142),
    )

    for i, rect in enumerate(char_cards):
        character_key = list(CHARACTERS.keys())[i]
        character = CHARACTERS[character_key]
        color = character["color"]
        center_x = rect.x + rect.w // 2

        if selected_character == character_key:
            screen.draw.filled_rect(rect, (42, 48, 39))
            draw_outline(rect, color, 3)
            screen.draw.text("SELECIONADO", center=(center_x, rect.y + 18), fontsize=13, color=color)
        else:
            screen.draw.filled_rect(rect, (31, 35, 32))
            draw_outline(rect, (73, 80, 69), 2)

        screen.blit(f"{character_key}_front", (center_x - 22, rect.y + 49))
        screen.draw.text(character["gender"], center=(center_x, rect.y + 131), fontsize=13, color=color)
        screen.draw.text(character["name"], center=(center_x, rect.y + 160), fontsize=25, color="white")
        screen.draw.text(character["subtitle"], center=(center_x, rect.y + 198), fontsize=13, color=(204, 207, 190))

    screen.draw.filled_rect(play_btn, (62, 69, 39))
    draw_outline(play_btn, (232, 214, 121), 3)
    screen.draw.text("ENTRAR NO LABIRINTO", center=(WIDTH // 2, 565), fontsize=27, color="white")
    screen.draw.text(
        "CLIQUE OU USE 1-4 PARA ESCOLHER  |  ENTER: JOGAR",
        center=(WIDTH // 2, 640),
        fontsize=15,
        color=(176, 183, 142),
    )


def draw_gameplay():
    for y in range(len(mapa)):
        for x in range(len(mapa[y])):
            pos = (x * cw, y * ch)
            if mapa[y][x] == 1:
                screen.blit("wall", pos)
            elif mapa[y][x] == 2:
                screen.blit("exit", pos)
            else:
                screen.blit("floor", pos)

    player.x = player.grid_x * cw + cw // 2
    player.y = player.grid_y * ch + ch // 2
    player.draw()

    for enemy in active_enemies:
        enemy.x = enemy.grid_x * cw + cw // 2
        enemy.y = enemy.grid_y * ch + ch // 2
        enemy.draw()

    hud_color = CHARACTERS[selected_character]["color"]
    screen.draw.text(
        f"NÍVEL {current_level + 1}",
        (18, 14),
        fontsize=20,
        color=hud_color,
    )
    screen.draw.text(
        f"AMEAÇAS: {len(active_enemies)}",
        (WIDTH - 170, 14),
        fontsize=20,
        color=(235, 120, 90),
    )
    screen.draw.text(
        MONSTERS[current_level]["name"],
        (WIDTH - 170, 38),
        fontsize=16,
        color=MONSTERS[current_level]["color"],
    )

    for y in range(0, HEIGHT, 20):
        for x in range(0, WIDTH, 20):
            dx = x - player.x
            dy = y - player.y
            if (dx * dx + dy * dy) ** 0.5 > 120:
                screen.draw.filled_rect(Rect((x, y), (20, 20)), "black")

    if state == "gameover":
        screen.blit("game_over", (0, 0))
        screen.draw.text("R = REINICIAR", center=(WIDTH // 2, 560), fontsize=30, color="white")

    if state == "victory":
        screen.fill("black")
        screen.draw.text("VOCE ESCAPOU!", center=(WIDTH // 2, 250), fontsize=50, color="green")
        screen.draw.text("R = JOGAR NOVAMENTE", center=(WIDTH // 2, 350), fontsize=28, color="white")


def draw():
    screen.clear()

    if state == "menu":
        draw_menu()
        return

    draw_gameplay()


def can_move(x, y):
    if y < 0 or y >= len(mapa):
        return False
    if x < 0 or x >= len(mapa[0]):
        return False
    return mapa[y][x] != 1


def handle_player_movement():
    moves = [
        (keyboard.left or keyboard.a, -1, 0, "left"),
        (keyboard.right or keyboard.d, 1, 0, "right"),
        (keyboard.up or keyboard.w, 0, -1, "back"),
        (keyboard.down or keyboard.s, 0, 1, "front"),
    ]

    for key_down, dx, dy, img in moves:
        if key_down:
            nx = player.grid_x + dx
            ny = player.grid_y + dy
            player.image = f"{selected_character}_{img}"
            if can_move(nx, ny):
                player.grid_x = nx
                player.grid_y = ny
            break


def move_enemy(enemy):
    start = (enemy.grid_x, enemy.grid_y)
    target = (player.grid_x, player.grid_y)
    queue = deque([(start, None)])
    visited = {start}

    while queue:
        (x, y), first_step = queue.popleft()
        if (x, y) == target:
            if first_step is not None:
                enemy.grid_x, enemy.grid_y = first_step
            return

        for next_pos in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            nx, ny = next_pos
            if next_pos not in visited and can_move(nx, ny):
                visited.add(next_pos)
                queue.append((next_pos, next_pos if first_step is None else first_step))


def update(dt):
    global state, current_level, player_move_timer, enemy_move_timer

    if state != "game":
        return

    player_move_timer += dt
    if player_move_timer >= player_move_interval:
        player_move_timer = 0
        handle_player_movement()

    enemy_move_timer += dt
    if enemy_move_timer >= enemy_move_intervals[current_level]:
        enemy_move_timer = 0
        for enemy in active_enemies:
            move_enemy(enemy)

    if any((player.grid_x, player.grid_y) == (enemy.grid_x, enemy.grid_y) for enemy in active_enemies):
        state = "gameover"

    if mapa[player.grid_y][player.grid_x] == 2:
        if current_level < len(LEVELS) - 1:
            current_level += 1
            load_level(current_level)
        else:
            state = "victory"


def on_mouse_down(button, pos):
    global selected_character
    x, y = pos

    if state == "menu":
        if play_btn.x <= x <= play_btn.x + play_btn.w and play_btn.y <= y <= play_btn.y + play_btn.h:
            reset_game()
            return

        for i, rect in enumerate(char_cards):
            if rect.x <= x <= rect.x + rect.w and rect.y <= y <= rect.y + rect.h:
                keys_list = list(CHARACTERS.keys())
                selected_character = keys_list[i]
                return


def on_key_down(key):
    global selected_character
    if state == "menu":
        if key == keys.K_1:
            selected_character = "runner"
        elif key == keys.K_2:
            selected_character = "guardian"
        elif key == keys.K_3:
            selected_character = "ghost"
        elif key == keys.K_4:
            selected_character = "scout"
        elif key in (keys.RETURN, keys.SPACE):
            reset_game()
        return

    if state in ["gameover", "victory"] and key == keys.R:
        reset_game()
