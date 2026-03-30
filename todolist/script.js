let db;
const DB_NAME = 'ProjectTaskTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let projects = [];
let currentProjectId = null;
let dateForNewProject = null;

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const clockEl = document.getElementById('clock');
    const countdownDaysEl = document.getElementById('countdown-days');
    const projectList = document.getElementById('project-list');
    const todoList = document.getElementById('todo-list');
    // Modal elements
    const projectModal = document.getElementById('project-modal');
    const taskModal = document.getElementById('task-modal');
    const showAddTaskModalBtn = document.getElementById('show-add-task-modal-btn');
    const addProjectBtn = document.getElementById('add-project-btn');
    const addTaskBtn = document.getElementById('add-task-btn');
    const projectModalInput = document.getElementById('project-modal-input');
    const taskModalInput = document.getElementById('task-modal-input');
    const taskModalDeadline = document.getElementById('task-modal-deadline');

    // --- Time & Background ---
    const updateClockAndBackground = () => {
        const now = new Date();
        const hours = now.getHours();
        document.body.className = ''; // Clear classes
        if (hours >= 5 && hours < 12) document.body.classList.add('bg-morning');
        else if (hours >= 12 && hours < 18) document.body.classList.add('bg-afternoon');
        else document.body.classList.add('bg-evening');
        clockEl.textContent = now.toLocaleString('zh-CN');
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        const isLeap = new Date(now.getFullYear(), 1, 29).getDate() === 29;
        countdownDaysEl.textContent = (isLeap ? 366 : 365) - dayOfYear;
    };

    // --- DB Functions ---
    const initDB = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = e => reject(`数据库错误: ${e.target.errorCode}`);
        request.onsuccess = e => { db = e.target.result; resolve(db); };
        request.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
                e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    const saveDataToDB = () => new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
        projects.forEach(p => transaction.objectStore(STORE_NAME).add(p));
        transaction.oncomplete = resolve;
        transaction.onerror = e => reject(`保存数据出错: ${e.target.error}`);
    });
    const loadDataFromDB = () => new Promise((resolve, reject) => {
        const request = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll();
        request.onsuccess = e => { projects = e.target.result || []; resolve(); };
        request.onerror = e => reject(`加载数据出错: ${e.target.error}`);
    });

    // --- Render Functions ---
    const renderAll = () => { renderProjects(); renderTasks(); };

    const renderProjects = () => {
        projectList.innerHTML = '';
        const grouped = projects.reduce((acc, p) => { (acc[p.date] = acc[p.date] || []).push(p); return acc; }, {});
        const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
        const todayStr = new Date().toISOString().split('T')[0];

        if (!grouped[todayStr]) sortedDates.unshift(todayStr);

        sortedDates.forEach(date => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'project-date-group';
            const header = document.createElement('div');
            header.className = 'date-header';
            const addBtn = document.createElement('button');
            addBtn.className = 'add-btn';
            addBtn.textContent = '+';
            addBtn.onclick = (e) => { e.stopPropagation(); dateForNewProject = date; projectModal.style.display = 'block'; projectModalInput.focus(); };
            header.textContent = new Date(date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
            header.appendChild(addBtn);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'project-items-container';
            if (date === todayStr) itemsContainer.classList.add('open');
            header.addEventListener('click', () => itemsContainer.classList.toggle('open'));

            (grouped[date] || []).forEach(project => {
                const item = document.createElement('div');
                item.className = 'project-item';
                item.dataset.id = project.id;
                if (project.id === currentProjectId) item.classList.add('active');
                const completed = project.tasks.filter(t => t.completed).length;
                const progress = project.tasks.length > 0 ? (completed / project.tasks.length) * 100 : 0;
                item.style.setProperty('--progress', `${progress}%`);

                item.innerHTML = `<div class="project-item-details"><div class="project-header" contenteditable="true">${project.name}</div></div><button class="delete-project-btn">&times;</button>`;
                
                item.addEventListener('click', () => { currentProjectId = project.id; renderAll(); });

                const projectHeaderEl = item.querySelector('.project-header');
                projectHeaderEl.addEventListener('click', e => e.stopPropagation());
                projectHeaderEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
                projectHeaderEl.addEventListener('blur', async (e) => {
                    const newName = e.target.textContent.trim();
                    if (newName && newName !== project.name) { project.name = newName; await saveDataToDB(); } 
                    else { e.target.textContent = project.name; }
                });
                item.querySelector('.delete-project-btn').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`确定要删除项目 "${project.name}" 吗？`)) {
                        projects = projects.filter(p => p.id !== project.id);
                        if (currentProjectId === project.id) currentProjectId = null;
                        await saveDataToDB();
                        renderAll();
                    }
                });
                itemsContainer.appendChild(item);
            });
            groupContainer.appendChild(header);
            groupContainer.appendChild(itemsContainer);
            projectList.appendChild(groupContainer);
        });
    };

    const renderTasks = () => {
        todoList.innerHTML = '';
        const project = projects.find(p => p.id === currentProjectId);
        if (project) {
            project.tasks.forEach(task => {
                const item = document.createElement('li');
                item.dataset.id = task.id;
                if (task.completed) item.classList.add('completed');
                
                const deadline = new Date(task.deadline);
                const remainingMs = deadline - new Date();
                const isUrgent = remainingMs < 10 * 60 * 1000 && !task.completed;
                let remainingText = '';
                if (remainingMs > 0) {
                    const minutes = Math.floor((remainingMs / 1000 / 60) % 60);
                    const hours = Math.floor((remainingMs / (1000 * 60 * 60)) % 24);
                    remainingText = `剩余: ${hours}h ${minutes}m`;
                } else if (!task.completed) {
                    remainingText = '已超时';
                }

                if (!task.completed && remainingMs < 0) item.classList.add('overdue');

                item.innerHTML = `
                    <span class="task-text" contenteditable="true">${task.text}</span>
                    <span class="task-remaining-time ${isUrgent ? 'urgent' : ''}">${remainingText}</span>
                    <div>
                        <button class="complete-btn">${task.completed ? '撤销' : '完成'}</button>
                        <button class="delete-btn">删除</button>
                    </div>
                `;
                
                const taskTextEl = item.querySelector('.task-text');
                taskTextEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
                taskTextEl.addEventListener('blur', async (e) => {
                    const newText = e.target.textContent.trim();
                    if (newText && newText !== task.text) { task.text = newText; await saveDataToDB(); } 
                    else { e.target.textContent = task.text; }
                });

                item.querySelector('.complete-btn').addEventListener('click', () => { task.completed = !task.completed; saveDataToDB().then(renderAll); });
                item.querySelector('.delete-btn').addEventListener('click', () => { project.tasks = project.tasks.filter(t => t.id !== task.id); saveDataToDB().then(renderAll); });
                todoList.appendChild(item);
            });
        }
    };

    // --- Modal & Add Logic ---
    const setupModals = () => {
        const closeBtns = document.querySelectorAll('.close-btn');
        closeBtns.forEach(btn => btn.onclick = () => { btn.closest('.modal').style.display = 'none'; });
        window.onclick = e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
        showAddTaskModalBtn.onclick = () => { if(currentProjectId) { taskModal.style.display = 'block'; taskModalInput.focus(); } else { alert('请先选择一个项目'); } };
        addProjectBtn.onclick = async () => {
            const name = projectModalInput.value.trim();
            if (name && dateForNewProject) {
                const newProject = { id: Date.now(), name, date: dateForNewProject, tasks: [] };
                projects.push(newProject);
                currentProjectId = newProject.id;
                await saveDataToDB();
                renderAll();
                projectModalInput.value = '';
                projectModal.style.display = 'none';
            }
        };
        addTaskBtn.onclick = async () => {
            const text = taskModalInput.value.trim();
            const time = taskModalDeadline.value;
            const project = projects.find(p => p.id === currentProjectId);
            if (text && time && project) {
                const deadline = new Date(`${project.date}T${time}`);
                const newTask = { id: Date.now(), text, completed: false, deadline: deadline.toISOString() };
                project.tasks.push(newTask);
                await saveDataToDB();
                renderAll();
                taskModalInput.value = '';
                taskModalDeadline.value = '';
                taskModal.style.display = 'none';
            }
        };
    };
    
    // --- Main ---
    const main = async () => {
        await initDB();
        await loadDataFromDB();

        if (projects.length > 0 && !currentProjectId) {
            const todayStr = new Date().toISOString().split('T')[0];
            const todayProjects = projects.filter(p => p.date === todayStr);
            currentProjectId = todayProjects.length > 0 ? todayProjects[0].id : projects.sort((a,b) => new Date(b.date) - new Date(a.date))[0].id;
        }

        renderAll();
        setupModals();
        setInterval(updateClockAndBackground, 1000);
        setInterval(renderTasks, 60 * 1000); // Update countdowns every minute
        updateClockAndBackground();
    };

    main();
});
