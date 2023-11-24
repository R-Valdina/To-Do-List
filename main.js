// Add an event listener to the window object that triggers when the page is fully loaded
window.addEventListener('load', () => {
    // Retrieve todos from local storage or initialize an empty array if none exist
    //makes  this a global variable doesn't need let or const
	todos = JSON.parse(localStorage.getItem('todos')) || [];

    // Get references to the input fields and form in the document
	const nameInput = document.querySelector('#name');
	const newTodoForm = document.querySelector('#new-todo-form');

     // Retrieve the stored username or set to an empty string if none is stored
	const username = localStorage.getItem('username') || '';

    // Event listener to update the username in local storage when it changes
	nameInput.value = username;

    // Event listener to update the username in local storage when it changes
	nameInput.addEventListener('change', (e) => {
		localStorage.setItem('username', e.target.value);
	})
    // Event listener for the new todo form submission
	newTodoForm.addEventListener('submit', e => {
		e.preventDefault();// Prevent the default form submit action

        // Create a new todo object from the form inputs
		const todo = {
			content: e.target.elements.content.value,
			category: e.target.elements.category.value,
			done: false, // Newly created todos are not done
			createdAt: new Date().getTime()// Timestamp for when the todo was created
		}

        // Add the new todo to the todos array and update local storage
		todos.push(todo);

		localStorage.setItem('todos', JSON.stringify(todos));

		// Reset the form fields and display the updated list of todos
		e.target.reset();

        // Initial display of todos when the page loads
		DisplayTodos();
	})

	DisplayTodos();
})

// Function to display the list of todos
function DisplayTodos () {
	const todoList = document.querySelector('#todo-list');    
	todoList.innerHTML = "";// Clear the existing list

    // Loop through each todo and create HTML elements for each
	todos.forEach(todo => {
        // Create elements for todo item, including label, input, and buttons
		const todoItem = document.createElement('div');
		todoItem.classList.add('todo-item');

		const label = document.createElement('label');
		const input = document.createElement('input');
		const span = document.createElement('span');
		const content = document.createElement('div');
		const actions = document.createElement('div');
		const edit = document.createElement('button');
		const deleteButton = document.createElement('button');

        //tell if the item is done or not done
		input.type = 'checkbox';
		input.checked = todo.done;
		span.classList.add('bubble');

        // Assign a class based on the todo's category
		if (todo.category == 'personal') {
			span.classList.add('personal');
		} else {
			span.classList.add('business');
		}

        // Set the content and styles for the todo item
		content.classList.add('todo-content');
		actions.classList.add('actions');
		edit.classList.add('edit');
		deleteButton.classList.add('delete');

		content.innerHTML = `<input type="text" value="${todo.content}" readonly>`;
		edit.innerHTML = 'Edit';
		deleteButton.innerHTML = 'Delete';

        // Append the elements to form the todo item structure
		label.appendChild(input);
		label.appendChild(span);
		actions.appendChild(edit);
		actions.appendChild(deleteButton);
		todoItem.appendChild(label);
		todoItem.appendChild(content);
		todoItem.appendChild(actions);

        // Add the todo item to the todo list in the DOM
		todoList.appendChild(todoItem);

        // Add styling for completed todos
		if (todo.done) {
			todoItem.classList.add('done');
		}

		// Event listener for marking a todo as done/not done
		input.addEventListener('change', (e) => {
			todo.done = e.target.checked;
			localStorage.setItem('todos', JSON.stringify(todos));

			if (todo.done) {
				todoItem.classList.add('done');
			} else {
				todoItem.classList.remove('done');
			}

			DisplayTodos()

		})

        // Event listener for editing a todo
        //gives functionality to the edit button
		edit.addEventListener('click', (e) => {
			const input = content.querySelector('input');
			input.removeAttribute('readonly');
			input.focus();
			input.addEventListener('blur', (e) => {
				input.setAttribute('readonly', true);
				todo.content = e.target.value;
				localStorage.setItem('todos', JSON.stringify(todos));
				DisplayTodos()

			})
		})
        // Event listener for deleting a todo
        //also adds fucntionality to the delete button
		deleteButton.addEventListener('click', (e) => {
			todos = todos.filter(t => t != todo);
			localStorage.setItem('todos', JSON.stringify(todos));
			DisplayTodos()
		})

	})
}