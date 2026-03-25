document.addEventListener('DOMContentLoaded', () => {
    const todoInput = document.getElementById('todo-input');
    const addTodoBtn = document.getElementById('add-todo-btn');
    const todoList = document.getElementById('todo-list');

    // Function to add a new todo
    const addTodo = () => {
        const todoText = todoInput.value.trim();
        if (todoText !== '') {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${todoText}</span>
                <button class="complete-btn">Complete</button>
                <button class="delete-btn">Delete</button>
            `;
            todoList.appendChild(listItem);
            todoInput.value = '';

            // Add event listeners for complete and delete buttons
            listItem.querySelector('.complete-btn').addEventListener('click', () => {
                listItem.classList.toggle('completed');
            });

            listItem.querySelector('.delete-btn').addEventListener('click', () => {
                todoList.removeChild(listItem);
            });
        }
    };

    // Event listener for adding a todo when button is clicked
    addTodoBtn.addEventListener('click', addTodo);

    // Event listener for adding a todo when Enter key is pressed in the input field
    todoInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addTodo();
        }
    });
});