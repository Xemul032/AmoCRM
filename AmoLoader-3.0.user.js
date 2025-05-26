// ==UserScript==
// @name AmoLoader
// @namespace http://tampermonkey.net/
// @version 1.0
// @description Загружает и выполняет скрипт с GitHub
// @author Рустам Кандеев, Александр Щёкин
// @match https://cplink.amocrm.ru/*
// @icon https://cplink.amocrm.ru/frontend/images/interface/meta/Icon-72.png
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      192.168.137.35
// @connect      sheets.googleapis.com
// @connect      docs.google.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      raw.githubusercontent.com
// @connect      api.ipify.org
// ==/UserScript==

(function() {
    'use strict';

    // URL основного скрипта на GitHub
    const scriptUrl = 'https://raw.githubusercontent.com/Xemul032/AmoCRM/refs/heads/main/amoCustomJS.js';

    // Функция для загрузки и исполнения скрипта
    function loadScript(url) {
    GM_xmlhttpRequest({
    method: 'GET',
    url: url,
    onload: function(response) {
    // Проверяем, успешно ли загружен скрипт
    if (response.status === 200) {
    try {
    // Выполняем загруженный скрипт
    eval(response.responseText);
    } catch (e) {
    console.error('Ошибка при выполнении скрипта:', e);
    }
    } else {
    console.error('Ошибка загрузки скрипта: HTTP статус', response.status);
    }
    },
    onerror: function(err) {
    console.error('Ошибка при запросе:', err);
    }
    });
    }

    // Загружаем и запускаем скрипт
    loadScript(scriptUrl);

    })();
