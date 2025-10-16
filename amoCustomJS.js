// ==UserScript==
// @name         Быстрые ответы для заданий - amoCRM
// @namespace    http://tampermonkey.net/
// @version      1.32
// @description  Добавляет кнопку с быстрыми ответами, зависящими от типа задачи (определяется при клике)
// @author       You
// @match        https://cplink.amocrm.ru/*
// @grant        GM_xmlhttpRequest
// @connect      script.googleusercontent.com
// @connect      script.google.com
// ==/UserScript==
(function () {
    'use strict';

    // Шаблоны ответов по типу задачи
    const quickRepliesByType = {
        "default": [["Нет быстрых ответов", ""]],
        "Связаться": [
            ["Перезвонил(а), работаю", "С клиентом связь налажена - работаю по заявке."],
            ["Перезвонил(а), не актуально", "Пропала потребность или не является заявкой"],
            ["Не берет трубку", "Не удалось связаться - не берет трубку"]
        ],
        "Встреча": [
            ["Встреча прошла", "Встреча состоялась, клиент заинтересован в сотрудничестве."],
            ["Перенос", "Встреча перенесена на следующую неделю."],
            ["Отмена", "Клиент отменил встречу."]
        ],
        "Статус сделки": [
            ["Продвижение", "Сделка продвигается."],
            ["Завершена", "Сделка успешно закрыта."],
            ["Застой", "Долгое время не было активности по сделке."]
        ],
        "Переадресация": [
            ["Взял(а) в работу", "Начата работа по сделке"],
            ["Некорректная переадресация", "Переадресовалось неверно - заявка не моя"]
        ],
        "Новое сообщение": [
            ["Не требует ответа", "Не требует ответа на последнее сообщение"],
        ],
    };

    // Функция обновления модального окна
    function updateModalContent(modal, replyList) {
        const dropdown = modal.dropdown;
        dropdown.innerHTML = "";
        replyList.forEach(([label, fullText]) => {
            const item = document.createElement("div");
            item.textContent = label;
            item.title = fullText;
            Object.assign(item.style, {
                padding: "8px",
                cursor: "pointer",
                marginBottom: "4px",
                borderBottom: "1px solid #eee"
            });
            item.addEventListener("click", () => {
                insertTextToActiveInput(fullText, modal);
                modal.style.display = "none";
            });
            dropdown.appendChild(item);
        });
    }

    // Найти целевой textarea
    function findTargetInput(container) {
        let inputEl = container.querySelector("textarea.card-task__result-wrapper__inner__textarea.js-task-result-textarea");
        if (!inputEl) {
            inputEl = container.querySelector("textarea.card-task__result-wrapper__inner__textarea.makeroi-textarea__task.js-task-result-textarea");
        }
        return inputEl;
    }

    // Создание кнопки
    function createQuickReplyButton(container) {
        const button = document.createElement("button");
        button.textContent = "Быстрые ответы";
        button.type = "button";
        button.className = "quick-reply-button";
        const originalButton = container.querySelector(".button-input_blue.card-task__button") ||
                               container.parentNode.querySelector(".button-input_blue.card-task__button") ||
                               document.querySelector(".button-input_blue.card-task__button");
        Object.assign(button.style, {
            marginTop: "0",
            marginRight: "8px",
            marginLeft: "8px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "6px 12px",
            fontSize: "13px",
            lineHeight: "18px",
            fontWeight: "500",
            color: "#fff",
            backgroundColor: "#4c8bf7",
            border: "none",
            borderRadius: "4px"
        });
        if (originalButton) {
            const styles = getComputedStyle(originalButton);
            button.style.height = styles.getPropertyValue("height");
        }
        return button;
    }

    // Создание модального окна
    function createModal() {
        const modal = document.createElement("div");
        modal.id = "quick-replies-modal-" + Date.now();
        modal.style.display = "none";
        Object.assign(modal.style, {
            position: "absolute",
            top: "auto",
            left: "auto",
            right: "auto",
            bottom: "auto",
            zIndex: "99999",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            backgroundColor: "#fff",
            borderRadius: "6px",
            padding: "16px",
            maxWidth: "400px",
            width: "max-content"
        });
        const dropdown = document.createElement("div");
        modal.dropdown = dropdown;
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "Закрыть";
        closeBtn.style.marginTop = "12px";
        closeBtn.style.padding = "6px 12px";
        closeBtn.style.float = "right";
        closeBtn.onclick = () => modal.style.display = "none";
        modal.appendChild(dropdown);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
        window.addEventListener("click", (e) => {
            if (e.target === modal) modal.style.display = "none";
        });
        return modal;
    }

    // Получаем тип задачи из title span.task-type-name-with-icon__text (при клике)
    function getTaskTypeOnClick(container) {
        // Поднимаемся до .card-task или его вариаций
        const taskCard = container.closest(".card-task");
        if (!taskCard) {
            return "default";
        }
        // Ищем span.task-type-name-with-icon__text внутри карточки
        const taskTypeElement = taskCard.querySelector("span.task-type-name-with-icon__text");
        if (!taskTypeElement || !taskTypeElement.hasAttribute("title")) {
            return "default";
        }
        const taskType = taskTypeElement.getAttribute("title").trim();
        return quickRepliesByType[taskType] ? taskType : "default";
    }

    // Вставка текста в активный элемент
    function insertTextToActiveInput(text, modal) {
        const textareaId = modal.dataset.textareaId;
        const activeEl = document.getElementById(textareaId);
        if (!activeEl) {
            return;
        }
        activeEl.value = text;
        ['input', 'propertychange', 'change', 'focus'].forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            activeEl.dispatchEvent(event);
        });
        setTimeout(() => {
            const parentContainer = activeEl.closest(".card-task__result-wrapper__inner.makeroi-task__result");
            if (parentContainer) {
                const infoInput = parentContainer.querySelector(".makeroi-task__info_input");
                const countSpan = infoInput?.querySelector(".makeroi-count");
                if (countSpan) {
                    countSpan.textContent = text.length;
                }
                parentContainer.focus({ preventScroll: true });
            }
            const executeButton = parentContainer?.querySelector(".button-input_blue.card-task__button");
            if (executeButton) {
                executeButton.classList.remove("hidden");
                executeButton.style.display = "";
                executeButton.removeAttribute("disabled");
                executeButton.setAttribute("tabindex", "0");
            }
        }, 50);
    }

    // Основная функция инъекции
    function injectQuickReplyButton(container) {
        if (container.querySelector(".quick-reply-button")) {
            return;
        }
        const inputEl = findTargetInput(container);
        if (!inputEl || inputEl.offsetParent === null) {
            return;
        }
        const button = createQuickReplyButton(container);
        button.dataset.textareaId = inputEl.id || 'textarea-' + Date.now();
        inputEl.id = inputEl.id || button.dataset.textareaId;
        const buttonContainer = container.querySelector('.card-task__result-wrapper__inner') ||
                                container.querySelector('.makeroi-task__info_input') ||
                                container;
        const originalExecuteButton = container.querySelector(".button-input_blue.card-task__button");
        if (originalExecuteButton && originalExecuteButton.parentNode) {
            originalExecuteButton.parentNode.insertBefore(button, originalExecuteButton);
        } else if (buttonContainer) {
            buttonContainer.appendChild(button);
        } else {
            inputEl.parentNode ? inputEl.parentNode.insertBefore(button, inputEl.nextSibling) : container.appendChild(button);
        }

        // --- ЛОГИКА ПРИ КЛИКЕ НА КНОПКУ ---
        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            inputEl.focus();
            // ✅ Получаем тип задачи при нажатии
            const taskType = getTaskTypeOnClick(container);
            const replies = quickRepliesByType[taskType] || quickRepliesByType.default;
            updateModalContent(modal, replies);
            const rect = button.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            let top = rect.bottom + window.scrollY;
            let left = rect.left + window.scrollX;
            if (left + 400 > viewportWidth + window.scrollX - 20) {
                left = rect.right + window.scrollX - 400;
            }
            if (top + 300 > viewportHeight + window.scrollY - 20) {
                top = rect.top + window.scrollY - 300 - 10;
            }
            modal.style.top = `${top}px`;
            modal.style.left = `${left}px`;
            modal.dataset.textareaId = button.dataset.textareaId;
            modal.style.display = "block";
        });
    }

    // Наблюдатель DOM
    function watchForContainers() {
        const observer = new MutationObserver(() => {
            const containers = document.querySelectorAll([
                ".card-task__result-wrapper__inner",
                ".card-task__result-wrapper__inner.expanded",
                ".makeroi-task__info_input",
                ".feed-compose__message-wrapper"
            ].join(", "));
            containers.forEach(injectQuickReplyButton);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(() => {
            const containers = document.querySelectorAll([
                ".card-task__result-wrapper__inner",
                ".card-task__result-wrapper__inner.expanded",
                ".makeroi-task__info_input",
                ".feed-compose__message-wrapper"
            ].join(", "));
            containers.forEach(injectQuickReplyButton);
        }, 2000); // Периодическая проверка
    }

    // Запуск наблюдателя
    const modal = createModal();
    watchForContainers();

    function bonusAndPenalty () {
        'use strict';
        // === Настройки ===
        const DEBUG = false; // Включить/выключить логи
        const WARNING_MINUTES_START = 16;
        const WARNING_MINUTES_END = 30;
        const BONUS_MINUTES_START = 0;
        const BONUS_MINUTES_END = 15;
        const YELLOW_COLOR = [255, 255, 0];
        const RED_COLOR = [255, 0, 0];
        const GREEN_COLOR = [0, 255, 0];
        const WHITE_COLOR = [255, 255, 255];
        const SCORE_START = -10;
        const SCORE_END = -100;
        const BONUS_SCORE_START = 15;
        const BONUS_SCORE_END = 0;
        const BG_OPACITY = 0.3;
        const CURRENT_HOUR_THRESHOLD = 11;
        const YESTERDAY_SCORE = -200;
        // =================
        const MONTH_MAP = {
            "января": 0,
            "февраля": 1,
            "марта": 2,
            "апреля": 3,
            "мая": 4,
            "июня": 5,
            "июля": 6,
            "августа": 7,
            "сентября": 8,
            "октября": 9,
            "ноября": 10,
            "декабря": 11
        };
        function debugLog(...args) {
            if (DEBUG) console.log('[Покрас просрочек]', ...args);
        }
        function getAllPipelineItems() {
            return document.querySelectorAll('[id^="pipeline_item_"]');
        }
        function parseRelativeDate(text) {
            const now = new Date();
            let match;
            if ((match = text.match(/Сегодня (\d{2}):(\d{2})/i))) {
                const [, h, m] = match;
                const date = new Date();
                date.setHours(h, m, 0, 0);
                return date;
            }
            if ((match = text.match(/Вчера (\d{2}):(\d{2})/i))) {
                const [, h, m] = match;
                const date = new Date();
                date.setDate(now.getDate() - 1);
                date.setHours(h, m, 0, 0);
                return date;
            }
            if ((match = text.match(/Позавчера (\d{2}):(\d{2})/i))) {
                const [, h, m] = match;
                const date = new Date();
                date.setDate(now.getDate() - 2);
                date.setHours(h, m, 0, 0);
                return date;
            }
            if ((match = text.match(/(\d{1,2})\s+(\w+)\s+(\d{2}:\d{2})/i))) {
                const [, day, monthStr, time] = match;
                const month = MONTH_MAP[monthStr.toLowerCase()];
                if (month === undefined) return null;
                const [h, m] = time.split(':');
                const year = now.getMonth() < month ? now.getFullYear() - 1 : now.getFullYear();
                const date = new Date(year, month, day, h, m, 0, 0);
                return date;
            }
            return null;
        }
        function interpolateColor(start, end, factor) {
            const result = start.map((startVal, i) =>
                Math.round(startVal + factor * (end[i] - start[i]))
            );
            return `rgba(${result.join(',')},${BG_OPACITY})`;
        }
        function interpolateScore(diffMinutes) {
            const clampedDiff = Math.min(Math.max(diffMinutes, WARNING_MINUTES_START), WARNING_MINUTES_END);
            const factor = (clampedDiff - WARNING_MINUTES_START) /
                          (WARNING_MINUTES_END - WARNING_MINUTES_START);
            return Math.round(SCORE_START + factor * (SCORE_END - SCORE_START));
        }
        function interpolateBonusScore(diffMinutes) {
            const clampedDiff = Math.min(Math.max(diffMinutes, BONUS_MINUTES_START), BONUS_MINUTES_END);
            const factor = 1 - (clampedDiff - BONUS_MINUTES_START) /
                          (BONUS_MINUTES_END - BONUS_MINUTES_START);
            return Math.round(BONUS_SCORE_START * factor);
        }
        function roundToNearest10(value) {
            return Math.round(value / 10) * 10;
        }
        function formatScoreText(score) {
            if (score <= 0) return '';
            const lastTwo = score % 100;
            const last = score % 10;
            if (lastTwo >= 11 && lastTwo <= 14) {
                return `${score} линков`;
            }
            switch (last) {
                case 1: return `${score} линк`;
                case 2:
                case 3:
                case 4: return `${score} линка`;
                default: return `${score} линков`;
            }
        }
        function highlightItem(item, color, score) {
            // Убираем подсветку и счётчик только если score == 0
            if (score === 0) {
                item.style.backgroundColor = '';
                const existingCounter = item.querySelector('.delay-score-counter');
                if (existingCounter) existingCounter.remove();
                return;
            }
            // Применяем цвет фона
            item.style.cssText = `background-color: ${color} !important;`;
            const existingCounter = item.querySelector('.delay-score-counter');
            if (!existingCounter) {
                const targetElement = item.querySelector('.pipeline-unsorted__item-main > span');
                if (targetElement) {
                    const counter = document.createElement('div');
                    counter.className = 'delay-score-counter';
                    let formattedText;
                    if (score > 0) {
                        formattedText = `+ ${formatScoreText(score)}`;
                    } else {
                        formattedText = `${score} линков`;
                    }
                    counter.textContent = formattedText;
                    Object.assign(counter.style, {
                        display: 'inline-block',
                        marginTop: '8px',
                        padding: '6px 12px',
                        backgroundColor: '#ffffff',
                        color: score > 0 ? '#008000' : '#e60000',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        borderRadius: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        border: '1px solid #ccc'
                    });
                    targetElement.after(counter);
                }
            }
        }
        let isProcessing = false;
        function checkAndHighlightItems() {
            if (isProcessing) {
                return;
            }
            isProcessing = true;
            const now = new Date();
            const currentHour = now.getHours();
            const items = getAllPipelineItems();
            items.forEach((item) => {
                const dateEl = item.querySelector('.pipeline-unsorted__item-date');
                if (!dateEl) return;
                const text = dateEl.textContent.trim();
                const date = parseRelativeDate(text);
                if (!date) return;
                const diffMinutes = (now - date) / 1000 / 60;
                const existingCounter = item.querySelector('.delay-score-counter');
                if (existingCounter) existingCounter.remove();
                if (text.startsWith("Вчера") && currentHour >= CURRENT_HOUR_THRESHOLD) {
                    highlightItem(item, 'rgba(255,0,0,0.4)', YESTERDAY_SCORE);
                    return;
                }
                if (diffMinutes >= BONUS_MINUTES_START && diffMinutes < BONUS_MINUTES_END) {
                    const factor = 1 - (diffMinutes - BONUS_MINUTES_START) /
                                   (BONUS_MINUTES_END - BONUS_MINUTES_START);
                    const score = interpolateBonusScore(diffMinutes);
                    const color = interpolateColor(WHITE_COLOR, GREEN_COLOR, factor);
                    highlightItem(item, color, score);
                    return;
                }
                if (diffMinutes >= WARNING_MINUTES_START) {
                    let color = 'rgba(255,0,0,0.3)';
                    if (diffMinutes < WARNING_MINUTES_END) {
                        const factor = (diffMinutes - WARNING_MINUTES_START) /
                                       (WARNING_MINUTES_END - WARNING_MINUTES_START);
                        color = interpolateColor(YELLOW_COLOR, RED_COLOR, factor);
                    }
                    const score = roundToNearest10(interpolateScore(diffMinutes));
                    highlightItem(item, color, score);
                }
            });
            isProcessing = false;
        }
        function startMonitoring() {
            let attempts = 0;
            const maxAttempts = 30;
            const interval = setInterval(() => {
                checkAndHighlightItems();
                const items = getAllPipelineItems();
                if (items.length > 0 || attempts >= maxAttempts) {
                    clearInterval(interval);
                    setupObserver();
                }
                attempts++;
            }, 1000);
        }
        function setupObserver() {
            let observerTimeout = null;
            const observer = new MutationObserver(() => {
                clearTimeout(observerTimeout);
                observerTimeout = setTimeout(() => {
                    checkAndHighlightItems();
                }, 500); // Дебаунс изменений
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        startMonitoring();
    };
    bonusAndPenalty();


function hideSalesbot() {
    'use strict';

    function cleanSuggestions(container) {
        const parentDiv = container.querySelector("div");
        if (!parentDiv) return;

        // 1. Скрыть элементы с data-suggestion-type="1"
        const elementsWithType1 = Array.from(parentDiv.children).filter(child =>
            child.getAttribute('data-suggestion-type') === "1"
        );

        elementsWithType1.forEach(el => {
            el.style.display = "none";
        });

        // 2. Скрыть второй дочерний div
        const secondChildDiv = document.querySelector(
            "#contenteditable_suggestions > div > div:nth-child(2)"
        );
        if (secondChildDiv) {
            secondChildDiv.style.display = "none";
        }

        // 3. Скрыть четырнадцатый дочерний div
        const fourteenthChildDiv = document.querySelector(
            "#contenteditable_suggestions > div > div:nth-child(14)"
        );
        if (fourteenthChildDiv) {
            fourteenthChildDiv.style.display = "none";
        }
    }

    // Наблюдатель за DOM-изменениями
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                const container = document.querySelector("#contenteditable_suggestions");
                if (container) {
                    cleanSuggestions(container);
                }
            }
        });
    });

    // Начинаем наблюдение за body
    observer.observe(document.body, { childList: true, subtree: true });
};

hideSalesbot();


function AxiomAPI() {
    'use strict';
    let lastProcessedPhone = null;
    const originalPlaceholders = {};

    function cleanPhoneNumber(phone) {
        if (!phone) return '';
        let cleaned = phone.toString().replace(/\D/g, '');
        if (cleaned.startsWith('7') && cleaned.length === 11) {
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }

    function formatManagerName(fullName) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 3) return `${parts[0]} ${parts[2]}`;
        return fullName;
    }

    function getPhoneFromPage() {
        const phoneInput = document.querySelector(
            'div.linked-form__field-pei div.js-control-phone.control-phone input'
        );
        return phoneInput ? cleanPhoneNumber(phoneInput.value) : null;
    }

    function expandHiddenFields() {
        const showMoreButton = document.querySelector('.js-linked-show-all-fields');
        if (showMoreButton && !showMoreButton.classList.contains('hidden')) {
            const style = window.getComputedStyle(showMoreButton);
            if (style.display !== 'none') {
                showMoreButton.click();
            }
        }
    }

    async function getPersons() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://192.168.137.35:3000/api/person',
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`Persons API error: ${response.status}`));
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

    async function getClients() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://192.168.137.35:3000/api/clients',
                onload: function(response) {
                    if (response.status === 200) {
                        resolve(JSON.parse(response.responseText));
                    } else {
                        reject(new Error(`Clients API error: ${response.status}`));
                    }
                },
                onerror: function(err) {
                    reject(err);
                }
            });
        });
    }

    function buildPersonMap(persons) {
        const map = {};
        for (const person of persons) {
            map[person.UUID] = person;
        }
        return map;
    }

    function buildClientMap(clients) {
        const map = {};
        for (const client of clients) {
            map[client.UUID] = client;
        }
        return map;
    }

    function showLoadingPlaceholder(selector) {
        const field = document.querySelector(selector);
        if (!field) return;
        const input = field.querySelector("input");
        if (!input || input.dataset.loadingInterval) return;
        if (!originalPlaceholders[selector]) {
            originalPlaceholders[selector] = input.placeholder;
        }
        input.placeholder = "Идёт поиск.";
        let dotCount = 0;
        const interval = setInterval(() => {
            if (!document.body.contains(input)) {
                clearInterval(interval);
                return;
            }
            dotCount = (dotCount + 1) % 4;
            input.placeholder = "Идёт поиск" + ".".repeat(dotCount);
        }, 400);
        input.dataset.loadingInterval = interval.toString();
    }

    function restorePlaceholder(selector) {
        const field = document.querySelector(selector);
        const input = field?.querySelector("input");
        if (!input) return;
        const original = originalPlaceholders[selector];
        if (original !== undefined) {
            input.placeholder = original;
        }
        if (input.dataset.loadingInterval) {
            clearInterval(parseInt(input.dataset.loadingInterval));
            delete input.dataset.loadingInterval;
        }
    }

    function isUserSelected() {
        const span = document.querySelector("#lead_main_user-users_select_holder > ul > li > span");
        if (!span) return false;
        const text = span.textContent.trim();
        return text !== '' && !/^\.+$/.test(text);
    }

    function insertValueIntoField(selector, value) {
        const field = document.querySelector(selector);
        if (!field) return;
        const input = field.querySelector("input");
        if (!input) return;
        restorePlaceholder(selector);
        input.value = value;
        input.readOnly = true;

        if (isUserSelected()) {
            ['input', 'change'].forEach(eventType => {
                const event = new Event(eventType, { bubbles: true });
                input.dispatchEvent(event);
            });
        }
    }

    function isFieldFilled(selector) {
        const field = document.querySelector(selector);
        const input = field?.querySelector("input");
        if (!input) return false;
        const value = input.value.trim();
        const placeholder = input.placeholder?.trim();
        return value !== '' && value !== placeholder;
    }

    async function findClientAndManagerByPhone(cleanedPhone) {
        if (!cleanedPhone) return;

        const managerSelector = ".linked-form__fields > div:nth-child(5) > .linked-form__field__value";
        const clientSelector = ".linked-form__fields > div:nth-child(6) > .linked-form__field__value";

        if (isFieldFilled(managerSelector) && isFieldFilled(clientSelector)) {
            return;
        }

        let foundClients = [];
        let foundManagers = [];

        try {
            const [persons, clients] = await Promise.all([getPersons(), getClients()]);
            const personMap = buildPersonMap(persons);
            const clientMap = buildClientMap(clients);

            for (const client of clients) {
                for (const personUUID of client.Persons) {
                    const person = personMap[personUUID];
                    if (person && person.Contacts) {
                        for (const contact of person.Contacts) {
                            const cleanedContact = cleanPhoneNumber(contact);
                            if (cleanedContact.includes(cleanedPhone)) {
                                foundClients.push(client.Name);
                                const manager = personMap[client.Manager];
                                if (manager) {
                                    foundManagers.push(`${manager.Name} ${manager.Patronymic} ${manager.Surname}`);
                                }
                            }
                        }
                    }
                }
            }

            if (foundClients.length === 0) {
                return;
            }

            expandHiddenFields();
            await new Promise(resolve => setTimeout(resolve, 50));

            if (!document.querySelector(managerSelector) || !document.querySelector(clientSelector)) {
                return;
            }

            showLoadingPlaceholder(managerSelector);
            showLoadingPlaceholder(clientSelector);

            if (new Set(foundManagers).size === 1) {
                insertValueIntoField(managerSelector, formatManagerName(foundManagers[0]));
                insertValueIntoField(clientSelector, foundClients[foundClients.length - 1]);
            } else {
                insertValueIntoField(managerSelector, foundManagers.map(manager => manager.split(' ')[2]).join(', '));
                insertValueIntoField(clientSelector, "2 и более клиентов");
            }

            setTimeout(() => {
                const saveButtonSpan = document.querySelector("#save_and_close_contacts_link > span > span");
                if (saveButtonSpan && saveButtonSpan.textContent.trim() === "Сохранить") {
                    const saveButton = saveButtonSpan.closest("#save_and_close_contacts_link");
                    if (saveButton && !saveButton.disabled) {
                        saveButton.click();
                    }
                }
            }, 300);

        } catch (err) {
            return;
        } finally {
            if (document.querySelector(managerSelector)) restorePlaceholder(managerSelector);
            if (document.querySelector(clientSelector)) restorePlaceholder(clientSelector);
        }
    }

    function checkForPhoneInput() {
        const currentPhone = getPhoneFromPage();
        if (currentPhone && currentPhone !== lastProcessedPhone) {
            lastProcessedPhone = currentPhone;
            findClientAndManagerByPhone(currentPhone);
        }
    }

    const observer = new MutationObserver(() => {
        checkForPhoneInput();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    setInterval(checkForPhoneInput, 3000);
}

// Запуск
AxiomAPI();
    
function blurUnsorted() {
    'use strict';

    const TARGET_SELECTOR = "#card_holder > div.js-card-feed.card-holder__feed > div > div.notes-wrapper__scroller.custom-scroll > div > div.notes-wrapper__notes.js-notes";
    const STATUS_SELECTOR = "#card_status_view_mode .pipeline-select-view__status span";
    const HIDE_SELECTOR = "[data-id='amo_wapp_im']";

    const DATE_SELECTOR = "div.js-feed-note__date.feed-note__date"; // для поиска дат
    const CARD_ACTIONS_SELECTOR = "#card_fields > div.unsorted-actions-card"; // элемент, который нужно скрыть

    const USERNAME_SELECTOR = "#left_menu > div.nav__top > div.nav__top__userbar > div.nav__top__userbar__userinfo.js-manage-profile > div.nav__top__userbar__userinfo__username";

    const SPREADSHEET_URL = 'https://script.google.com/macros/s/AKfycbwdNZbfEfVvWmYHksd0vJN_7D3BL4d4soyjs_qJXfRh-I5zsTFAZSTdXZCA-afsD0VO/exec '; // убедитесь, что URL правильный

    const MAX_POINTS = 15; // максимальное количество баллов
    const MIN_TIME_THRESHOLD = 1; // минуты
    const MAX_TIME_THRESHOLD = 15; // минуты

    let blurApplied = false;

    function isDetailPage() {
        return window.location.pathname.includes('/leads/detail/');
    }

    function parseCustomDate(dateStr) {
        const now = new Date();
        let date;

        if (dateStr.startsWith("Сегодня")) {
            const time = dateStr.replace("Сегодня ", "").trim();
            const [hours, minutes] = time.split(":");
            date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
        } else if (dateStr.startsWith("Вчера")) {
            const time = dateStr.replace("Вчера ", "").trim();
            const [hours, minutes] = time.split(":");
            date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, hours, minutes);
        } else {
            date = new Date(dateStr);
        }

        return isNaN(date.getTime()) ? null : date;
    }

    function getEarliestDateAndDiff() {
        const elements = document.querySelectorAll(DATE_SELECTOR);

        if (!elements.length) return null;

        const dates = [];

        elements.forEach(el => {
            const rawDate = el.textContent.trim();
            const parsedDate = parseCustomDate(rawDate);
            if (parsedDate) dates.push(parsedDate);
        });

        if (!dates.length) return null;

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const now = new Date();
        const diffMinutes = Math.floor((now - minDate) / 60000); // разница в минутах

        return { earliest: minDate, diff: diffMinutes };
    }

function calculatePoints(diffMinutes) {
    if (diffMinutes <= MIN_TIME_THRESHOLD) return MAX_POINTS;
    if (diffMinutes >= MAX_TIME_THRESHOLD) return 0;

    // Линейная шкала от MAX_POINTS до 1 между 1 и 15 минутами
    const points = MAX_POINTS - Math.floor((diffMinutes / MAX_TIME_THRESHOLD) * MAX_POINTS);
    return Math.max(0, Math.min(MAX_POINTS, points));
}

    function sendToGoogleSheet(data) {
        const payload = JSON.stringify(data);

        GM_xmlhttpRequest({
            method: 'POST',
            url: SPREADSHEET_URL,
            data: payload,
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function (response) {

            },
            onerror: function (err) {
                console.error('[sendToGoogleSheet] Ошибка отправки:', err.statusText);
            }
        });
    }

    function applyBlurAndNotification(container) {
        if (blurApplied || !container) return;



        const cardActions = document.querySelector(CARD_ACTIONS_SELECTOR);
        if (cardActions) {
            cardActions.style.display = 'none';

        }

        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'block';
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(container);

        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backdropFilter = 'blur(5px)';
        overlay.style.webkitBackdropFilter = 'blur(5px)';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        overlay.style.zIndex = '9999';
        overlay.style.pointerEvents = 'auto';

        const button = document.createElement('button');
        button.textContent = 'Взять в работу';
        button.style.position = 'absolute';
        button.style.top = '90%';
        button.style.left = '50%';
        button.style.transform = 'translate(-50%, -50%)';
        button.style.backgroundColor = '#000';
        button.style.color = '#fff';
        button.style.padding = '12px 30px';
        button.style.borderRadius = '8px';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        button.style.textAlign = 'center';
        button.style.whiteSpace = 'nowrap';
        button.style.zIndex = '10000';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        button.style.cursor = 'pointer';

        button.addEventListener('click', () => {


            const acceptButton = document.querySelector("#card_unsorted_accept > span");
            if (acceptButton) {
                acceptButton.click();
            }

            const elementToRestore = document.querySelector(HIDE_SELECTOR);
            if (elementToRestore) {
                elementToRestore.style.display = '';
            }

            removeBlurAndNotification();

            const result = getEarliestDateAndDiff();
            if (!result) {
                console.warn('[Клик] Не удалось получить разницу во времени.');
                return;
            }

            const bonusPoints = calculatePoints(result.diff);

            const userElement = document.querySelector(USERNAME_SELECTOR);
            const username = userElement ? userElement.textContent.trim() : 'Неизвестный пользователь';

            const currentUrl = window.location.href;

            // Форматируем дату из самой ранней заметки
            const dateToAdd = result.earliest.toLocaleDateString('ru-RU'); // формат: дд.мм.гг

            const payload = {
                Имя: username,
                Ссылка: currentUrl,
                Бонусные_баллы: bonusPoints,
                Дата: dateToAdd
            };


            sendToGoogleSheet(payload);
        });

        overlay.appendChild(button);
        wrapper.appendChild(overlay);

        blurApplied = true;
    }

    function removeBlurAndNotification() {
        if (!blurApplied) return;

        const overlay = document.querySelector(`[data-blur-overlay]`);
        if (overlay) overlay.remove();

        blurApplied = false;

    }

    function hideAmoWappIm(hide = true) {
        const elementToHide = document.querySelector(HIDE_SELECTOR);
        if (elementToHide) {
            elementToHide.style.display = hide ? 'none' : '';

        }
    }

    function checkStatusAndApplyBlur() {
        if (!isDetailPage()) {
            removeBlurAndNotification();
            hideAmoWappIm(false);
            return;
        }

        const statusSpan = document.querySelector(STATUS_SELECTOR);
        const container = document.querySelector(TARGET_SELECTOR);

        const statusText = statusSpan?.textContent.trim();

        if (statusText === "Неразобранное") {
            hideAmoWappIm(true);
            applyBlurAndNotification(container);
        } else {
            hideAmoWappIm(false);
            removeBlurAndNotification();
        }
    }

    const observer = new MutationObserver(() => {
        checkStatusAndApplyBlur();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const originalPushState = history.pushState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        checkStatusAndApplyBlur();
    };

    const popStateListener = () => {
        checkStatusAndApplyBlur();
    };

    window.addEventListener('popstate', popStateListener);

    checkStatusAndApplyBlur();

}

// Запуск функции
blurUnsorted();

function notification() {
    'use strict';

    let wasVisible = false;         // Флаг для "новой заявки"
    let wasCongratsVisible = false; // Флаг для "Поздравляем!"

    // Функция для клика по кнопке "Забрать заявку"
    function clickTargetButton() {
        const targetBtn = document.querySelector(
            "#f5_smartresp_acceptance_right_bottom > div.smartresp_wrapper_items > div > div.wrapper_item.wrapper_item_actions > button > span"
        );

        if (targetBtn) {
            targetBtn.click();
        }
    }

    // Функция для клика по кнопке "Перейти к сделке"
    function clickNavigateButton() {
        const navigateBtn = Array.from(document.querySelectorAll('button.js-smartresp-navigate-link')).find(
            btn => btn.textContent.trim() === "Перейти к сделке"
        );

        if (navigateBtn) {
            navigateBtn.click();
        }
    }

    // Показ уведомления для новой заявки — БЕЗ фокуса вкладки
    function showNewRequestNotification() {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            const notification = new Notification("🔔 Новая заявка! 🔔", {
                body: "Кликни сюда, чтобы забрать!",
                icon: "https://raw.githubusercontent.com/Xemul032/Axiom/refs/heads/main/notification_11682149.png"
            });

            notification.onclick = function() {
                clickTargetButton(); // ← Без window.focus()
                notification.close();
            };

        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    const notification = new Notification("🔔 Новая заявка! 🔔", {
                        body: "Кликни сюда, чтобы забрать!",
                        icon: "https://raw.githubusercontent.com/Xemul032/Axiom/refs/heads/main/notification_11682149.png"
                    });



                    notification.onclick = function() {
                        clickTargetButton(); // ← Без window.focus()
                        notification.close();
                    };
                }
            });
        }
    }

    // Показ уведомления для "Поздравляем!" — С фокусом вкладки
    function showCongratsNotification() {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            const notification = new Notification("🎉 Поздравляем! 🎉", {
                body: "Кликни сюда, чтобы перейти к сделке!",
                icon: "https://raw.githubusercontent.com/Xemul032/Axiom/refs/heads/main/mark_16208218.png"
            });

            notification.onclick = function() {
                window.focus();         // ← Переключаем вкладку
                clickNavigateButton();
                notification.close();
            };

        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(function (permission) {
                if (permission === "granted") {
                    const notification = new Notification("🎉 Поздравляем! 🎉", {
                        body: "Кликни сюда, чтобы перейти к сделке!",
                        icon: "https://raw.githubusercontent.com/Xemul032/Axiom/refs/heads/main/mark_16208218.png"
                    });

                    notification.onclick = function() {
                        window.focus();     // ← Переключаем вкладку
                        clickNavigateButton();
                        notification.close();
                    };
                }
            });
        }
    }

    // Проверка появления целевых элементов
    function checkElement() {
        // Проверка на элемент "прогресс" (новая заявка)
        const progressElement = document.querySelector(
            "#f5_smartresp_acceptance_right_bottom > div.smartresp_wrapper_items > div > div.wrapper_item.wrapper_item_progress"
        );

        if (progressElement && !wasVisible) {
            wasVisible = true;
            showNewRequestNotification();
        } else if (!progressElement && wasVisible) {
            wasVisible = false;
        }

        // Проверка на элемент "Поздравляем!"
        const congratsElement = document.querySelector(
            "#f5_smartresp_acceptance_right_bottom > div.smartresp_wrapper_items > div > div.wrapper_item.wrapper_item_header"
        );

        const isCongratsVisible = congratsElement && congratsElement.textContent.trim() === "Поздравляем!";

        if (isCongratsVisible && !wasCongratsVisible) {
            wasCongratsVisible = true;
            showCongratsNotification();
        } else if (!isCongratsVisible && wasCongratsVisible) {
            wasCongratsVisible = false;
        }
    }

    // Первый запуск
    checkElement();

    // MutationObserver для отслеживания изменений DOM
    const observer = new MutationObserver(checkElement);
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Резервная проверка раз в 500 мс
    setInterval(checkElement, 500);
}

notification();

})();
