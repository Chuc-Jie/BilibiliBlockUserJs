// ==UserScript==
// @name         B站批量拉黑工具
// @namespace    https://github.com/
// @version      1.0.2
// @description  批量拉黑B站用户（支持用户名输入）- 脚本猫菜单触发版
// @author       友野YouyEr
// @match        *://*.bilibili.com/*
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      bilibili.com
// @connect      api.bilibili.com
// ==/UserScript==

(function() {
    'use strict';
    
    GM_addStyle(`
        #batchBlockContainer {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            width: 400px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            padding: 20px;
            font-family: sans-serif;
            border: 1px solid #fb7299;
            display: none; /* 默认隐藏 */
        }
        #batchBlockContainer h3 {
            margin: 0 0 15px;
            color: #fb7299;
            font-size: 16px;
            text-align: center;
        }
        #usernameInput {
            width: 100%;
            height: 150px;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            font-family: monospace;
            font-size: 12px;
        }
        #controlBtns {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .batch-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.3s;
        }
        #startBtn {
            background: #fb7299;
            color: white;
            flex: 1;
        }
        #startBtn:hover {
            background: #ff8ab0;
        }
        #startBtn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        #clearBtn {
            background: #eee;
            color: #333;
        }
        #clearBtn:hover {
            background: #ddd;
        }
        #logArea {
            height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            line-height: 1.5;
            background: #f9f9f9;
            font-family: monospace;
        }
        .success { color: #4CAF50; font-weight: bold; }
        .error { color: #f44336; font-weight: bold; }
        .info { color: #2196F3; }
        .warning { color: #ff9800; }
        
        /* 可拖拽样式 */
        .draggable {
            cursor: move;
        }
        .drag-handle {
            background: #fb7299;
            color: white;
            padding: 5px 10px;
            border-radius: 8px 8px 0 0;
            cursor: move;
            text-align: center;
            margin: -20px -20px 15px -20px;
        }
    `);

    // 创建操作面板（默认隐藏）
    function createPanel() {
        if (document.getElementById('batchBlockContainer')) {
            return document.getElementById('batchBlockContainer');
        }

        const container = document.createElement('div');
        container.id = 'batchBlockContainer';
        container.innerHTML = `
            <div class="drag-handle">⇳ 拖拽移动</div>
            <h3>B站批量拉黑工具</h3>
            <textarea id="usernameInput" placeholder='请输入用户名，支持以下格式：&#10;1. 每行一个用户名&#10;2. Python列表格式：["用户名1","用户名2"]&#10;3. JSON数组格式：["用户名1","用户名2"]'></textarea>
            <div id="controlBtns">
                <button id="startBtn" class="batch-btn">开始批量拉黑</button>
                <button id="clearBtn" class="batch-btn">清空</button>
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">
                状态: <span id="statusText">就绪</span> | 
                进度: <span id="progressText">0/0</span>
            </div>
            <div id="logArea"></div>
        `;
        document.body.appendChild(container);

        // 绑定事件
        document.getElementById('startBtn').addEventListener('click', startBatchBlock);
        document.getElementById('clearBtn').addEventListener('click', clearAll);

        // 添加拖拽功能
        makeDraggable(container, container.querySelector('.drag-handle'));
        return container;
    }

    // 显示面板
    function showPanel() {
        const panel = createPanel();
        panel.style.display = 'block';
        log('面板已显示，可开始输入用户名', 'info');
    }

    // 拖拽功能
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // 清空所有内容
    function clearAll() {
        document.getElementById('usernameInput').value = '';
        document.getElementById('logArea').innerHTML = '';
        updateStatus('已清空', '0/0');
    }

    // 更新状态
    function updateStatus(status, progress) {
        const statusEl = document.getElementById('statusText');
        const progressEl = document.getElementById('progressText');
        if (statusEl) statusEl.textContent = status;
        if (progressEl) progressEl.textContent = progress;
    }

    // 解析用户输入的用户名列表
    function parseUsernames(input) {
        input = input.trim();
        if (!input) return [];

        // 尝试解析JSON数组格式
        if (input.startsWith('[') && input.endsWith(']')) {
            try {
                const jsonStr = input.replace(/'/g, '"');
                const list = JSON.parse(jsonStr);
                if (Array.isArray(list) && list.every(item => typeof item === 'string')) {
                    return list.filter(username => username.trim());
                }
            } catch (e) {
                log(`输入的列表格式有误（${e.message}），将尝试按行解析`, 'warning');
            }
        }

        // 按行解析
        return input.split('\n')
            .map(line => line.trim())
            .filter(line => line);
    }

    // 从用户名获取UID
    async function getUidByUsername(username) {
        try {
            const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(username)}`;
            
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'User-Agent': navigator.userAgent,
                    'Referer': 'https://www.bilibili.com/'
                }
            });
            
            if (!response.ok) {
                throw new Error(`网络请求失败: ${response.status}`);
            }
            
            const data = await response.json();

            if (data.code !== 0) {
                throw new Error(`搜索接口错误: ${data.message || data.code}`);
            }

            if (!data.data || !data.data.result) {
                throw new Error('搜索结果为空');
            }

            // 精确匹配用户名
            const user = data.data.result.find(item => 
                item.uname && item.uname.trim() === username.trim()
            );
            
            if (user && user.mid) {
                return user.mid;
            } else {
                throw new Error('未找到精确匹配的用户');
            }
        } catch (e) {
            throw new Error(`获取UID失败: ${e.message}`);
        }
    }

    // 拉黑指定UID的用户
    async function blockUser(uid) {
        try {
            const biliJct = getCookie('bili_jct');
            if (!biliJct) {
                throw new Error('未找到CSRF令牌，请确保已登录B站');
            }

            const response = await fetch('https://api.bilibili.com/x/relation/modify', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': navigator.userAgent,
                    'Referer': 'https://www.bilibili.com/'
                },
                body: new URLSearchParams({
                    fid: uid,
                    act: 5, // 5表示拉黑
                    re_src: 11,
                    csrf: biliJct
                })
            });

            const data = await response.json();
            if (data.code !== 0) {
                throw new Error(`拉黑失败: ${data.message || '未知错误'}`);
            }
            return true;
        } catch (e) {
            throw new Error(`拉黑操作失败: ${e.message}`);
        }
    }

    // 获取Cookie
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // 日志输出
    function log(message, type = 'info') {
        const logArea = document.getElementById('logArea');
        if (!logArea) return;
        const logItem = document.createElement('div');
        logItem.className = type;
        logItem.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        logArea.appendChild(logItem);
        logArea.scrollTop = logArea.scrollHeight;
    }

    // 批量拉黑主流程
    async function startBatchBlock() {
        const input = document.getElementById('usernameInput').value;
        const usernames = parseUsernames(input);

        if (usernames.length === 0) {
            log('请输入有效的用户名', 'error');
            GM_notification({
                text: '请输入有效的用户名',
                title: 'B站批量拉黑工具',
                timeout: 3000
            });
            return;
        }

        log(`开始处理 ${usernames.length} 个用户...`, 'info');
        updateStatus('处理中...', `0/${usernames.length}`);
        
        const startBtn = document.getElementById('startBtn');
        startBtn.disabled = true;
        startBtn.textContent = '处理中...';

        let successCount = 0;
        let failCount = 0;

        for (const [index, username] of usernames.entries()) {
            const current = index + 1;
            const total = usernames.length;
            
            updateStatus('处理中...', `${current}/${total}`);
            log(`处理第 ${current}/${total} 个: ${username}`, 'info');
            
            try {
                const uid = await getUidByUsername(username);
                log(`获取到UID: ${uid}`, 'info');

                await blockUser(uid);
                log(`✅ 成功拉黑用户: ${username} (UID: ${uid})`, 'success');
                successCount++;
            } catch (e) {
                log(`❌ 处理失败: ${e.message}`, 'error');
                failCount++;
            }

            // 延迟1秒，避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const summary = `批量处理完成 | 成功: ${successCount} | 失败: ${failCount}`;
        log(summary, successCount === usernames.length ? 'success' : 'warning');
        updateStatus('完成', `${successCount}/${usernames.length}`);
        
        startBtn.disabled = false;
        startBtn.textContent = '开始批量拉黑';

        GM_notification({
            text: `批量拉黑完成：成功${successCount}个，失败${failCount}个`,
            title: 'B站批量拉黑工具',
            timeout: 5000
        });
    }

    // 注册脚本猫菜单
    function registerMenu() {
        // 脚本猫菜单命令：点击显示面板
        GM_registerMenuCommand('显示批量拉黑面板', showPanel, '📌');
        // 可选：添加隐藏面板的菜单
        GM_registerMenuCommand('隐藏批量拉黑面板', () => {
            const panel = document.getElementById('batchBlockContainer');
            if (panel) panel.style.display = 'none';
        }, '🙈');
    }

    // 初始化：只注册菜单，不自动显示面板
    function init() {
        registerMenu();
        log('脚本已就绪，可通过脚本猫菜单打开面板', 'info');
    }

    // 启动脚本
    init();
})();