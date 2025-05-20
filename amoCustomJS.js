// ==UserScript==
// @name         Быстрые ответы для заданий - amoCRM
// @namespace    http://tampermonkey.net/
// @version      1.18
// @description  Добавляет кнопку с быстрыми ответами, зависящими от типа задачи (определяется при клике)
// @author       You
// @match        https://cplink.amocrm.ru/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("✅ Скрипт запущен");

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
            console.warn("❌ Не найден .card-task");
            return "default";
        }

        // Ищем span.task-type-name-with-icon__text внутри карточки
        const taskTypeElement = taskCard.querySelector("span.task-type-name-with-icon__text");

        if (!taskTypeElement || !taskTypeElement.hasAttribute("title")) {
            console.warn("❌ Элемент с типом задачи или title не найдены");
            return "default";
        }

        const taskType = taskTypeElement.getAttribute("title").trim();
        console.log("🟢 Тип задачи (из title):", taskType);

        return quickRepliesByType[taskType] ? taskType : "default";
    }

    // Вставка текста в активный элемент
    function insertTextToActiveInput(text, modal) {
        const textareaId = modal.dataset.textareaId;
        const activeEl = document.getElementById(textareaId);

        if (!activeEl) {
            console.warn("❌ Целевой textarea не найден:", textareaId);
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
            console.warn("⚠️ Кнопка уже добавлена");
            return;
        }

        const inputEl = findTargetInput(container);
        if (!inputEl || inputEl.offsetParent === null) {
            console.warn("❌ Не найдено видимое поле ввода в контейнере:", container);
            return;
        }

        console.log("🟢 Целевое поле ввода найдено, создаю кнопку...");

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
})();
