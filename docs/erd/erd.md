# MORAGO — ERD (первая версия для обсуждения)

> Модель данных составлена по макетам Figma (клиент, переводчик, админка), таблице мест/сфер, описанию проекта и согласованным требованиям.
> Детали, которые не удалось однозначно определить, вынесены в раздел «Вопросы».

Цепочка работы: **макеты и требования → бизнес-сущности → связи → таблицы**.

## Обозначения

**Термины**

| Термин | Что значит | Пример из MORAGO |
|---|---|---|
| Сущность | «Вещь», о которой приложение хранит данные. Каждая сущность становится таблицей | User, Call, Wallet |
| PK (Primary Key, первичный ключ) | Поле, которое однозначно определяет одну запись, обычно `id`. Двух записей с одним PK не бывает | `call.id` |
| FK (Foreign Key, внешний ключ) | Поле, которое ссылается на запись в другой таблице. Так таблицы связываются | `call.client_id` указывает на `user.id` |
| UK (Unique Key) | Значение в поле не может повторяться | `user.phone`: два пользователя с одним номером невозможны |
| nullable | Поле можно оставить пустым | `theme.category_id` у «Экстренного вызова» |
| Связующая таблица | Третья таблица, которая раскрывает связь N:M. Каждая строка это одна пара | `translator_theme`: переводчик + тема |
| Снимок (snapshot) | Копия значения на момент события, которая потом не меняется | `call.price_per_minute` |
| Кэш | Готовое вычисленное значение, которое хранится для быстрого чтения, а источник правды лежит в другом месте | `wallet.balance` (источник правды: журнал `transaction`) |

**Типы связей** (примеры в разделе 4)

| Запись | Читается | Коротко |
|---|---|---|
| **1:1** | один к одному | У одной записи ровно одна парная запись с другой стороны |
| **1:N** | один ко многим | Одна запись связана со многими записями другой таблицы, а те в ответ связаны только с одной. **N** значит «сколько угодно»: ноль, один или много, это не конкретное число |
| **N:M** | многие ко многим | С обеих сторон «много». В базе всегда раскрывается через связующую таблицу |
| **1:0..1** | один к нулю или одному | «0..1» значит «не больше одного»: парная запись может быть, а может не быть |

**Линии на диаграмме.** Каждый конец линии показывает, сколько записей может быть с этой стороны:

| Символ | Значение |
|---|---|
| `\|\|` | ровно один |
| `\|o` | ноль или один |
| `o{` | ноль или много |
| `\|{` | один или много |

Пример: `USER ||--o{ CALL` читается слева направо как «один пользователь, ноль или много звонков», а справа налево как «у звонка ровно один пользователь (клиент)».

## 1. Диаграмма

```mermaid
erDiagram
    USER ||--o| TRANSLATOR_PROFILE : "has (if translator)"
    USER ||--|| WALLET : owns
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ PASSWORD_RESET_TOKEN : requests
    FILE |o--o{ USER : "avatar"

    CATEGORY |o--o{ THEME : contains
    FILE |o--o{ CATEGORY : "icon"
    FILE |o--o{ THEME : "icon"

    TRANSLATOR_PROFILE ||--o{ TRANSLATOR_LANGUAGE : speaks
    LANGUAGE ||--o{ TRANSLATOR_LANGUAGE : "spoken by"
    TRANSLATOR_PROFILE ||--o{ TRANSLATOR_THEME : "specializes in"
    THEME ||--o{ TRANSLATOR_THEME : "covered by"

    USER ||--o{ CALL : "requests (client)"
    TRANSLATOR_PROFILE ||--o{ CALL : "serves"
    LANGUAGE ||--o{ CALL : "language of"
    THEME ||--o{ CALL : "theme of"

    CALL ||--o| REVIEW : "rated by"
    USER ||--o{ CONVERSATION : "client in"
    TRANSLATOR_PROFILE ||--o{ CONVERSATION : "translator in"
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ MESSAGE : sends
    CALL |o--o{ MESSAGE : "sent during"
    TRANSLATOR_PROFILE ||--o{ REVIEW : "gets"

    WALLET ||--o{ TRANSACTION : records
    CALL |o--o{ TRANSACTION : "charged by"
    TRANSLATOR_PROFILE ||--o{ PAYOUT_REQUEST : requests
    PAYOUT_REQUEST |o--o| TRANSACTION : "results in"

    USER {
        bigint id PK
        string phone UK "login, code is sent by SMS"
        string email UK "nullable, used for password recovery"
        string password_hash
        string role "USER | TRANSLATOR | ADMIN"
        string full_name
        bigint avatar_file_id FK
        string status "ACTIVE | BLOCKED"
        datetime blocked_at "nullable"
        string block_reason "nullable"
        boolean notifications_enabled "Profile > Notifications"
        datetime phone_verified_at
        datetime created_at
    }

    TRANSLATOR_PROFILE {
        bigint user_id PK, FK
        date date_of_birth
        int topik_level "Korean level (TOPIK)"
        decimal price_per_minute "set by the translator, KRW"
        boolean is_online "Available / Not available"
        string verification_status "REGISTERED | INTERVIEW_SCHEDULED | APPROVED | REJECTED"
        decimal rating_avg
        int reviews_count
    }

    LANGUAGE {
        int id PK
        string code UK "ISO 639-1"
        string name
    }

    TRANSLATOR_LANGUAGE {
        bigint translator_id PK, FK
        int language_id PK, FK
    }

    CATEGORY {
        int id PK
        string name UK "Sphere: Medicine, Auto, Law ..."
        bigint icon_file_id FK
        boolean is_active
    }

    THEME {
        int id PK
        int category_id FK "nullable (Emergency call)"
        string name "Place: Hospital, Bank, Court ..."
        string name_ko "Korean name"
        string description
        bigint icon_file_id FK
        boolean is_emergency
        boolean is_active
    }

    TRANSLATOR_THEME {
        bigint translator_id PK, FK
        int theme_id PK, FK
        boolean with_certificate "Topics with certificate"
    }

    VERIFICATION_CODE {
        bigint id PK
        string phone
        string purpose "REGISTRATION | LOGIN"
        string code_hash
        int attempts
        datetime expires_at
        datetime used_at
    }

    PASSWORD_RESET_TOKEN {
        bigint id PK
        bigint user_id FK
        string token_hash
        datetime expires_at
        datetime used_at "nullable"
        datetime created_at
    }

    FILE {
        bigint id PK
        bigint owner_id FK "nullable"
        string url
        string mime_type
        datetime created_at
    }

    CALL {
        bigint id PK
        bigint client_id FK
        bigint translator_id FK
        int language_id FK
        int theme_id FK
        string type "AUDIO | VIDEO"
        string status "REQUESTED | ACCEPTED | ACTIVE | ENDED | MISSED | REJECTED | FAILED"
        decimal price_per_minute "snapshot at call time"
        datetime requested_at
        datetime started_at
        datetime ended_at
        int duration_sec
        decimal total_cost
    }

    REVIEW {
        bigint id PK
        bigint call_id FK, UK
        bigint author_id FK
        bigint translator_id FK
        int rating "1-5 stars"
        string comment
        datetime created_at
    }

    CONVERSATION {
        bigint id PK
        bigint client_id FK "unique together with translator_id"
        bigint translator_id FK
        datetime created_at
        datetime last_message_at "nullable"
    }

    MESSAGE {
        bigint id PK
        bigint conversation_id FK
        bigint sender_id FK
        bigint call_id FK "nullable, set when sent during a call"
        string text
        datetime read_at "nullable"
        datetime created_at
    }

    WALLET {
        bigint id PK
        bigint user_id FK, UK
        decimal balance "cached, source of truth = transactions"
        string currency "KRW"
    }

    TRANSACTION {
        bigint id PK
        bigint wallet_id FK
        bigint call_id FK "nullable"
        bigint payout_request_id FK "nullable"
        bigint created_by FK "nullable, admin for manual charge"
        string type "TOPUP | ADMIN_CHARGE | CALL_CHARGE | CALL_EARNING | COMMISSION | PAYOUT | REFUND"
        decimal amount
        string status "PENDING | COMPLETED | FAILED"
        string provider_ref "payment gateway id"
        datetime created_at
    }

    PAYOUT_REQUEST {
        bigint id PK
        bigint translator_id FK
        decimal amount
        string bank_name
        string account_number
        string status "PENDING | APPROVED | REJECTED | PAID"
        bigint processed_by FK "USER (admin)"
        datetime created_at
        datetime processed_at
    }

    NOTIFICATION {
        bigint id PK
        bigint user_id FK
        string type "INCOMING_CALL | CALL_STATUS | SYSTEM ..."
        json payload
        boolean is_read
        datetime created_at
    }
```

Расшифровка обозначений (`PK`, `FK`, `UK`, типы связей, символы линий) находится в начале документа.

## 2. Как сущности получены из макетов

| Что видно в макетах | Сущность | Пояснение |
|---|---|---|
| Регистрация и вход клиента, переводчика, админа; пароль; код из SMS | **User**, **VerificationCode** | Одна таблица для трёх ролей, вход по телефону |
| Восстановление пароля (через почту) | **PasswordResetToken**, `user.email` | Одноразовая ссылка на email, срок действия ограничен |
| Edit Profile переводчика: ФИО, дата рождения, уровень корейского (TOPIK), статус Available / Not available | **TranslatorProfile** | Данные, которые есть только у переводчика |
| SMS со ссылкой на интервью после регистрации переводчика | `verification_status` | Статусы проверки: регистрация → интервью → одобрен / отклонён |
| Чипы «Available translation languages» | **Language**, **TranslatorLanguage** | Связь N:M |
| Таблица мест и сфер (Больница, Банк, Суд ...), разделы Themes и Categories в админке, экран выбора темы | **Category**, **Theme** | Связь 1:N: сфера содержит места |
| «Topics for translator» и «Topics for translation with certificate» | **TranslatorTheme** | Связь N:M, флаг `with_certificate` |
| Экраны Call, Recent, история звонков; аудио- и видеозвонок | **Call** | Статусы, тип звонка (`type`), тема, язык, время, стоимость |
| Чат клиента и переводчика (до, во время и после звонка) | **Conversation**, **Message** | Одна переписка на пару «клиент – переводчик», сообщения могут ссылаться на звонок |
| Экран с пятью звёздами после звонка | **Review** | Один отзыв на звонок |
| Balance клиента и переводчика, Top up, Details | **Wallet**, **Transaction** | Баланс и журнал операций |
| Withdrawal of funds (банк, номер счёта, сумма) | **PayoutRequest** | Заявка на вывод |
| Админка: Charge, Deposit history, Withdraw, Withdraw history | **Transaction** (типы `ADMIN_CHARGE`, `PAYOUT`), `created_by` | Ручное пополнение и вывод оформляет админ |
| Экран Notification | **Notification** | История уведомлений |
| Аватары, иконки категорий и тем | **File** | Одна таблица для всех файлов |
| Админка: списки Translator и User, формы Add new, блокировка | **User**, **TranslatorProfile** (`status`, `blocked_at`, `block_reason`, `verification_status`) | Новых таблиц не нужно |

## 3. Сущности

| Сущность | Зачем нужна | Главные поля |
|---|---|---|
| **User** | Один вход для всех трёх ролей (клиент, переводчик, админ) | `phone`, `email`, `password_hash`, `role`, `status`, `block_reason` |
| **TranslatorProfile** | Данные, которые есть только у переводчика. В User они были бы пустыми у остальных | `topik_level`, `is_online`, `verification_status`, `rating_avg` |
| **Language** | Справочник языков для фильтра и звонка | `code`, `name` |
| **Category** | Сфера: группа тем (Медицина, Авто, Закон ...) | `name`, `icon_file_id` |
| **Theme** | Конкретное место внутри сферы (Больница, Банк, Суд ...) | `category_id`, `name`, `name_ko`, `is_emergency` |
| **Call** | Один звонок (аудио или видео) между клиентом и переводчиком, центральная сущность | `client_id`, `translator_id`, `theme_id`, `type`, `status`, `started_at`, `total_cost` |
| **Review** | Оценка после звонка | `call_id`, `rating`, `comment` |
| **Conversation** | Переписка между одним клиентом и одним переводчиком, не зависит от звонков | `client_id`, `translator_id`, `last_message_at` |
| **Message** | Сообщение в переписке; если отправлено во время звонка, хранит ссылку на него | `conversation_id`, `sender_id`, `call_id`, `text`, `read_at` |
| **Wallet** | Кошелёк пользователя (у клиента и у переводчика) | `user_id`, `balance`, `currency` |
| **Transaction** | Журнал: каждое движение денег отдельной строкой | `wallet_id`, `type`, `amount`, `status` |
| **PayoutRequest** | Заявка переводчика на вывод средств | `translator_id`, `amount`, `bank_name`, `account_number`, `status` |
| **VerificationCode** | SMS-код для регистрации и входа | `phone`, `purpose`, `code_hash`, `expires_at` |
| **PasswordResetToken** | Одноразовый токен для восстановления пароля по почте | `user_id`, `token_hash`, `expires_at`, `used_at` |
| **Notification** | История уведомлений пользователя | `user_id`, `type`, `payload`, `is_read` |
| **File** | Все загруженные файлы в одном месте | `url`, `mime_type` |

Связующие таблицы **TranslatorLanguage** и **TranslatorTheme** раскрывают связи N:M.

## 4. Связи

В последней колонке указано поле, в котором хранится ссылка на связанную запись.

| Связь | Тип | Смысл связи | Как устроено в таблицах |
|---|---|---|---|
| User — TranslatorProfile | 1:1 (профиль необязателен) | У пользователя-переводчика ровно один профиль, у клиента и админа профиля нет. Профиль принадлежит одному пользователю | `translator_profile.user_id` одновременно PK и FK, поэтому второй профиль создать нельзя |
| User — Wallet | 1:1 | У пользователя один кошелёк, у кошелька один владелец | `wallet.user_id`, FK с UNIQUE |
| Category — Theme | 1:N | В одной сфере много мест, у места одна сфера (кроме «Экстренного вызова», у него сферы нет) | `theme.category_id`, FK, может быть пустым |
| TranslatorProfile — Language | **N:M** | Переводчик знает много языков, и на каждом языке говорит много переводчиков | Связующая таблица `translator_language`: два FK, вместе составляют PK |
| TranslatorProfile — Theme | **N:M** | Переводчик работает со многими темами, у темы много переводчиков | Связующая таблица `translator_theme`: два FK и флаг `with_certificate` |
| User (клиент) — Call | 1:N | Клиент делает много звонков, у звонка один клиент | `call.client_id`, FK |
| TranslatorProfile — Call | 1:N | Переводчик принимает много звонков, у звонка один переводчик | `call.translator_id`, FK |
| Theme — Call | 1:N | По одной теме бывает много звонков, у звонка одна тема | `call.theme_id`, FK |
| Language — Call | 1:N | На одном языке бывает много звонков, у звонка один язык | `call.language_id`, FK |
| Conversation — Message | 1:N | В переписке много сообщений, сообщение относится к одной переписке | `message.conversation_id`, FK |
| User — Conversation | 1:N | Клиент участвует во многих переписках, у переписки один клиент | `conversation.client_id`, FK |
| TranslatorProfile — Conversation | 1:N | Переводчик участвует во многих переписках, у переписки один переводчик | `conversation.translator_id`, FK |
| Call — Message | 1:N (необязательная) | Во время звонка может быть ноль или много сообщений, сообщение может быть и без звонка | `message.call_id`, FK, nullable |
| User — Message | 1:N | Пользователь отправляет много сообщений, у сообщения один отправитель | `message.sender_id`, FK |
| User — PasswordResetToken | 1:N | Пользователь может запросить восстановление несколько раз, токен принадлежит одному пользователю | `password_reset_token.user_id`, FK |
| Call — Review | 1:0..1 | У звонка может быть не больше одного отзыва (или ни одного), у отзыва ровно один звонок | `review.call_id`, FK с UNIQUE |
| TranslatorProfile — Review | 1:N | Переводчик получает много отзывов, отзыв адресован одному переводчику | `review.translator_id`, FK |
| Wallet — Transaction | 1:N | В кошельке много операций, операция относится к одному кошельку | `transaction.wallet_id`, FK |
| Call — Transaction | 1:N | По одному звонку несколько операций (списание, начисление, комиссия). Не у каждой операции есть звонок: пополнение к звонку не относится | `transaction.call_id`, FK, может быть пустым |
| TranslatorProfile — PayoutRequest | 1:N | Переводчик создаёт много заявок на вывод, заявка принадлежит одному переводчику | `payout_request.translator_id`, FK |
| PayoutRequest — Transaction | 1:0..1 | Заявке соответствует не больше одной операции вывода | `transaction.payout_request_id`, FK, может быть пустым |
| User — Notification | 1:N | У пользователя много уведомлений, уведомление адресовано одному пользователю | `notification.user_id`, FK |
| File — User, Category, Theme | 1:N | Один файл (картинку) могут использовать несколько записей, а у записи не больше одного файла (аватар, иконка) | `user.avatar_file_id`, `category.icon_file_id`, `theme.icon_file_id`, FK, могут быть пустыми |

**VerificationCode** не связана ни с одной таблицей внешним ключом: код отправляется на номер телефона ещё до создания пользователя.

## 5. Принятые решения

1. **Одна таблица User + TranslatorProfile**: у ролей общий вход и пароль, а данные, нужные только переводчикам, вынесены в отдельную таблицу, чтобы у клиентов и админов не было пустых полей.
2. **Баланс считается из журнала Transaction**, `Wallet.balance` это кэш. Записи журнала не меняются и не удаляются; баланс и журнал обновляются в одной транзакции БД.
3. **`price_per_minute` в Call это снимок** тарифа на момент звонка: смена цены не должна менять историю.
4. **Деньги хранятся как DECIMAL**, валюта KRW.
5. **Статусы переводчика**: после регистрации REGISTERED, после SMS со ссылкой на интервью INTERVIEW_SCHEDULED, затем админ ставит APPROVED или REJECTED. Принимать звонки может только APPROVED.
6. **Админ может создавать клиентов и переводчиков** (формы Add new / Add translator) и вручную пополнять баланс клиента (Charge).
7. **Цену за минуту задаёт переводчик**, она хранится в `TranslatorProfile.price_per_minute`. Оплата ведётся за минуты разговора в KRW.
8. **Вход по номеру телефона с кодом из SMS, восстановление пароля по почте.** Поэтому в User есть и `phone`, и `email`, а для сброса пароля используется отдельная таблица PasswordResetToken (в базе хранится хэш токена).
9. **Функции админа ограничены**: блокировка пользователей (`status = BLOCKED`, дата и причина) и разбор вопросов по оплате через Transaction и PayoutRequest. Исправления баланса оформляются новой записью в журнале, старые записи не меняются.
10. **Чат и видео входят в модель**: чат работает до, во время и после звонка. Переписка (Conversation) создаётся для пары «клиент – переводчик» и не зависит от звонков, сообщения (Message) принадлежат переписке и при отправке во время звонка ссылаются на него. Тип звонка хранится в `Call.type`.
11. **Email обязателен при регистрации**, так как пароль восстанавливается по почте. В базе поле допускает пустое значение для записей, созданных админом.

## 6. Не включено в модель (нет в макетах)

- **Жалобы и модерация звонков** (Complaint). Упомянуты в описании проекта, но экранов нет. Админ блокирует пользователей по собственному решению, без отдельной цепочки «жалоба → рассмотрение».
- **Документы для проверки переводчика** (VerificationDocument). В макетах проверка идёт через интервью, загрузки документов не видно.
- **Избранные переводчики**, **промокоды**, **расписание работы**. В макетах не найдены.

При необходимости соответствующие таблицы добавляются отдельно, остальная модель не меняется.

## 7. Seed-данные для Category и Theme (из таблицы мест)

| Сфера (Category) | Места (Theme) |
|---|---|
| Работа | Агентство труда, Завод, Мин труда |
| Медицина | Больница, Поликлиника, Вет клиника, Аптека |
| Авто | СТО, Авто салон, Прокат |
| Услуги | Рестораны, Свадебный салон, Банкетный зал, Магазин / Торговый центр, Салон красоты, Почта, Банк |
| Бизнес | Бизнес |
| Государственные учреждения | Гос страховка, Миграционный центр, Районный центр, Налоговая, Агентство недвижимости, Другое |
| Закон | Полиция, Прокуратура, Адвокатура, Суд, Нотариус |
| Образовательные учреждения (в таблице выделено красным, вероятно не утверждено) | Детский сад, Школа, Институт, Учебные курсы |
| без сферы | Экстренный вызов (`is_emergency = true`) |

Корейские названия и описания берутся из исходной таблицы. В самом низу таблицы есть ещё строка «Dentistry», её нужно уточнить.

## 8. Статус реализации

| Этап | Что сделано / будет сделано |
|---|---|
| **Готово (неделя 1)** | Каркас monorepo: `apps/web` (Vite + React + TypeScript), `apps/api` (Express + TypeScript, маршрут `/health`), `packages/contracts` (общие типы). Оба приложения запускаются из корня командой `pnpm dev`. Составлен этот ERD. |
| **Задание 2** | Перенос всей модели в `apps/api/prisma/schema.prisma`, миграции MySQL, seed (Language, Category, Theme), CRUD, регистрация и вход (JWT, bcrypt), роли, пагинация и фильтры, уведомления и чат через Socket.io, основа WebRTC (аудио и видео) |
| **Задание 3** | Логика звонка (тип, статусы, длительность, стоимость за минуту), Transaction и PayoutRequest (пополнение, списание, вывод), сигналинг WebRTC, хранилище файлов (S3, опционально) |
| **Финал** | Блокировка аккаунтов и проверка переводчиков, сброс пароля по почте (PasswordResetToken), загрузка файлов, Swagger, логирование, деплой |

Таблицы в базе данных будут созданы после согласования ERD.

## 9. Вопросы

Эти вопросы влияют на структуру таблиц.

1. **Видео:** цена за минуту видеозвонка такая же, как за аудио, или у переводчика два тарифа? Сейчас тариф один.
2. **Строка «Dentistry»** внизу исходной таблицы мест: это отдельная тема, сфера или лишняя запись? Пока не добавлена.

## 10. Допущения (требуют подтверждения)

Модель построена на следующих допущениях:

- видео- и аудиозвонок используют один тариф за минуту;
- у пары «клиент – переводчик» одна общая переписка, она существует независимо от звонков;
- языки перевода: русский, корейский, английский, китайский;
- ссылка для восстановления пароля действует ограниченное время и используется один раз;
- «Topics for translation with certificate» это отметка `with_certificate`, без загрузки файла;
- оценку после звонка ставит только клиент;
- банковские реквизиты вводятся при каждом выводе и хранятся в PayoutRequest;
- комиссия платформы пишется отдельной строкой `COMMISSION` в журнале, размер задаётся в настройках;
- жалобы, модерация звонков и документы для проверки в этом этапе не делаются (экранов нет).
