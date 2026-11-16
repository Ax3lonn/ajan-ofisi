# ajan-ofisi (Agent Office)

A mod for Claude Code that shows your subagents live, as pixel-art characters in an office, in a panel next to the chat. Each agent gets its own room and you can see at a glance who is working on what.

Version 0.2.1. [Türkçe](#türkçe)

## Features

- Every agent has its own full-width room, stacked vertically. A subagent started by another agent sits below that agent, indented.
- Rooms have a window (day or night), a shelf, a chair and a carpet in the color of the agent's model.
- Each room shows the agent's name, an elapsed-time counter, the model and a status line, a speech bubble with what the agent is doing right now, and a work-type marker (reading, writing, command, searching). The character moves according to the work.
- Desk items depend on the agent type: a book stack for researchers, a board for planners, a second screen for general agents.
- Long-running agents accumulate clutter: more paper on the desk as steps pile up, and a second mug after 5 minutes.
- When an agent finishes there is a short celebration (green frame, confetti), then the character leaves the room.
- At the top is the main session's manager room. It is furnished more nicely, has a nameplate and a wall clock, and shows the state: working, waiting for agents, or your turn. While it is your turn the character does not stand idle: it drinks coffee, reads a book, looks out the window or walks around, and dozes off after a long wait.
- Two views: Office and Tree.
- Finished work is in a list opened with a button. Click an agent to see its task, its last steps and its answer.

## Install

Requires a current Claude Code version that supports mods (plugins with a hooks module).

In a terminal session prompt:

```
/plugin install ajan-ofisi --marketplace Ax3lonn/ajan-ofisi
```

Then answer `y` to "Add marketplace?", pick a scope (user), and fill in the settings screen.

From the shell:

```
claude plugin install ajan-ofisi --marketplace Ax3lonn/ajan-ofisi
```

In the desktop app (`/plugin` does not work there): the + next to the prompt box, then Plugins, then Add marketplace: `Ax3lonn/ajan-ofisi`, then Add plugin.

## Settings

Set at install time or later from the `/config` menu.

| Setting    | Meaning                              | Default  |
| ---------- | ------------------------------------ | -------- |
| `owner`    | Name shown in the manager room       | `Claude` |
| `language` | Interface language, `en` or `tr`     | `en`     |

## Privacy and cost

The mod makes no model calls and uses no extra quota. It only watches events in your current session and draws them. It does not send any data anywhere.

## Development

```
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
hooks/register.tsx
types/index.d.ts
tests/
```

Validate and test:

```
claude plugin validate .
claude plugin test .
```

## License

MIT. See [LICENSE](LICENSE). Author: Ax3lonn.

---

## Türkçe

Claude Code için bir mod: alt ajanlarını sohbetin yanındaki panelde, piksel karakterlerle bir ofis olarak canlı gösterir. Her ajanın kendi odası vardır; kimin ne yaptığını bir bakışta görürsün.

Sürüm 0.2.1.

### Özellikler

- Her ajan tam genişlikte kendi odasında, alt alta durur. Bir ajanın başlattığı alt ajan, onun altında içeriden görünür.
- Odalarda pencere (gündüz/gece), raf, sandalye ve ajanın modelinin renginde halı vardır.
- Her odada ajanın adı, çalışma süresi sayacı, model ve durum satırı, o an ne yaptığını gösteren konuşma balonu ve iş türü işareti (okuyor, yazıyor, komut, arıyor) bulunur. Karakter işe göre hareket eder.
- Masa eşyası ajan türüne göre değişir: araştırmacıda kitap yığını, planlayıcıda pano, genel ajanda ikinci ekran.
- Uzun çalışan ajanda birikme olur: adımlar arttıkça masada kâğıt çoğalır, 5 dakikadan sonra ikinci kupa gelir.
- Ajan bitince kısa bir kutlama yapılır (yeşil çerçeve, konfeti), sonra karakter odadan çıkar.
- En üstte ana oturumun yönetici odası durur. Daha şık döşelidir, isim levhası ve duvar saati vardır; durumu gösterir: çalışıyor, ajanları bekliyor ya da sıra sende. Sıra sendeyken karakter boş durmaz: kahve içer, kitap okur, pencereden bakar, odada dolaşır; uzun beklemede uyuklar.
- İki görünüm vardır: Ofis ve Ağaç.
- Biten işler bir düğmeyle açılan listededir. Bir ajana tıklayınca görevi, son adımları ve cevabı görünür.

### Kurulum

Modları (hooks modülü olan eklentileri) destekleyen güncel bir Claude Code sürümü gerekir.

Terminal oturumunun isteminde:

```
/plugin install ajan-ofisi --marketplace Ax3lonn/ajan-ofisi
```

Ardından "Add marketplace?" sorusuna `y` de, kapsam olarak user seç, sonra ayar ekranını doldur.

Kabuktan:

```
claude plugin install ajan-ofisi --marketplace Ax3lonn/ajan-ofisi
```

Masaüstü uygulamasında (`/plugin` orada çalışmaz): istem kutusunun yanındaki + simgesi, Plugins, Add marketplace: `Ax3lonn/ajan-ofisi`, sonra Add plugin.

### Ayarlar

Kurulumda ya da sonradan `/config` menüsünden ayarlanır.

| Ayar       | Anlamı                                   | Varsayılan |
| ---------- | ---------------------------------------- | ---------- |
| `owner`    | Yönetici odasında görünen isim           | `Claude`   |
| `language` | Arayüz dili, `en` ya da `tr`             | `en`       |

### Gizlilik ve maliyet

Mod model çağrısı yapmaz ve ek kullanım harcamaz. Yalnızca oturumdaki olayları izler ve çizer. Hiçbir veriyi dışarı göndermez.

### Geliştirme

```
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
hooks/register.tsx
types/index.d.ts
tests/
```

Doğrulama ve test:

```
claude plugin validate .
claude plugin test .
```

### Lisans

MIT. Bkz. [LICENSE](LICENSE). Yazar: Ax3lonn.
