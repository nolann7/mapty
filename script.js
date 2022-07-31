'use strict';

///////////////////////
class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  constructor(coords, distance, duration) {
    this.coords = coords; // [lat,lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }
  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return (this.description = `${
      this.type[0].toUpperCase() + this.type.slice(1)
    } on ${months[this.date.getMonth()]} ${this.date.getDate()}`);
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = `running`;
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = `cycling`;
  constructor(coords, distance, duration, elevetionGain) {
    super(coords, distance, duration);
    this.elevetionGain = elevetionGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

/////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #curWorkout;
  markers = [];
  constructor() {
    this._getPosition();
    //local Storage
    this._getLocalStorage();
    // EventHandlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    // formEdit.addEventListener('submit', this._editWorkout.bind(this));
    // при изминении option в элементе select отображать разные элементы
    inputType.addEventListener('change', this._toggleElevationField);
    // центрирование карты пo клику по элементам workout в листе
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    // измененить элемент по клику на элемент workout в листе
    containerWorkouts.addEventListener(
      'dblclick',
      this._deleteWorkout.bind(this)
    );
    containerWorkouts.addEventListener(
      'contextmenu',
      this._showFormEdit.bind(this)
    );
  }
  _getPosition() {
    // проверка на старые браузеры
    if (navigator.geolocation) {
      // Запрос текущей геолокации у user
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          // нужно вызывать кб функцию с биндом this, потому что по умолчанию _loadMap вызовется не как метод, а как обычная функция, поэтому this  будет undefined
          alert('Your location is not defined');
        }
      );
    }
  }
  _loadMap(position) {
    const { latitude } = position.coords; // тоже самое --> const latitude = position.coords.latitude;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    // вывод карты в div с id map с помощью библиотеки leafletjs
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.#map);
    // аналог addEventListener в библиотеке leafletjs
    // handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // отобразить маркеры из локалсторадж, если есть
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }
  _showForm(mapE, editWorkout) {
    // чистим инпуты
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    this.#mapEvent = mapE;
    this.#curWorkout = editWorkout ? editWorkout : null;
    form.classList.remove('hidden'); // показываем форму при клике на карту
    inputDistance.focus(); // фокусируемся на нужном инпуте}
    //  если изменять текущий workout, а не создавать новый
    if (editWorkout) {
      if (inputType.value != editWorkout.type) this._toggleElevationField();
      inputType.value = editWorkout.type;
      inputDuration.value = editWorkout.duration;
      inputDistance.value = editWorkout.distance;
      if (editWorkout.type === 'running')
        inputCadence.value = editWorkout.cadence;
      if (editWorkout.type === 'cycling')
        inputElevation.value = editWorkout.elevetionGain;
    }
  }
  _hideForm() {
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
    // чистим инпуты
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
  }
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden'); // closest() method - is like reverse querySelector
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }
  _newWorkout(e) {
    // функция на проверку каждого элемента что бы был числом
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);
    e.preventDefault();

    // получить информацию из формы
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    let lat, lng;
    this.#mapEvent
      ? ({ lat, lng } = this.#mapEvent.latlng) // если новый
      : ([lat, lng] = this.#curWorkout.coords); // если изменять текущий
    let workout;

    // если тренировка бег - создать обьект running
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // валидировать информацию
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert(`Inputs have to be positive numbers!`);

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    // если тренировка cycling - создать обьект cycling
    if (type === 'cycling') {
      const elevetion = +inputElevation.value;
      // валидировать информацию
      if (
        !validInputs(distance, duration, elevetion) ||
        !allPositive(distance, duration)
      )
        return alert(`Inputs have to be positive numbers!`);
      workout = new Cycling([lat, lng], distance, duration, elevetion);
    }
    // добавить новый обьект в workout array
    this.#workouts.push(workout);

    // отобразить новую тренировку на карте как маркер
    this._renderWorkoutMarker(workout);

    // если это изменение текущего workout, то удалить текущий воркаут из списка и массива
    if (this.#curWorkout) {
      let currEl = containerWorkouts.querySelector(
        `[data-id="${this.#curWorkout.id}"]`
      );

      currEl.style.display = 'none';
      currEl.classList.add('hidden');

      this.#workouts.forEach((workout, index, arr) => {
        if (workout.id === this.#curWorkout.id) {
          arr.splice(index, 1);
        }
        this._setLocalStorage();
      });
    }
    // отобразить новую тренировку в списке
    this._renderWorkout(workout);

    // настроить local storage всем workout-ам
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup()
      .setZIndexOffset(workout.id);
    this.markers.push(marker);
  }
  _renderWorkout(workout) {
    let html = `
          <li class="workout workout--${workout.type}" data-id=${workout.id}>
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__details">
              <span class="workout__icon">${
                workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
              }</span>
              <span class="workout__value">${workout.distance}</span>
              <span class="workout__unit">km</span>
             </div>
            <div class="workout__details">
              <span class="workout__icon">⏱</span>
              <span class="workout__value">${workout.duration}</span>
              <span class="workout__unit">min</span>
            </div>
    `;
    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
      `;
    }
    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevetionGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;
    }
    if (this.#curWorkout) {
      let curEl = document.querySelector(`[data-id="${this.#curWorkout.id}"]`);
      curEl.insertAdjacentHTML('afterend', html);
    } else {
      form.insertAdjacentHTML('afterend', html);
    }
    // Спрятать форму и очистить поля инпута:
    this._hideForm();
  }
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return; // guard

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // присваиваем новые координаты нашей карте
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
    // Using API
    // workout.click(); - не работает prototype inheritence новых обьктов которые созданы из JSON строки, если захочу что бы работало - нужно заново пересоздать обьекты, которые сохранены в локалсторадж. Поэтому локалсторадж плох
  }
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); // обьект в строку
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts')); // превращает строку обратно в обьект
    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }
  _showFormEdit(e) {
    e.preventDefault();
    let currentWorkout = this.#workouts.find(
      workout => workout.id === e.target.closest('.workout').dataset.id
    );

    this._showForm(null, currentWorkout);
  }
  _deleteWorkout(e) {
    // удаляем все workout элементы при ctrl+dblclick
    if (e.ctrlKey) {
      this.markers.forEach(marker => {
        this.#map.removeLayer(marker);
      });
      Array.from(e.target.closest('.workouts').children).forEach(
        (element, i) => {
          if (i !== 0) element.style.display = 'none';
        }
      );
      this.#workouts = [];
      localStorage.removeItem('workouts'); // удаляем всё из локал сторадж
    }

    // удаляем один workout по которому кликнули два раза
    let dblClickedCurrentWorkout = e.target.closest('.workout');
    this.markers.forEach(marker => {
      if (marker.options.zIndexOffset == dblClickedCurrentWorkout.dataset.id)
        this.#map.removeLayer(marker);
    });
    dblClickedCurrentWorkout.style.display = 'none';
    this.#workouts.forEach((workout, index, arr) => {
      if (workout.id === dblClickedCurrentWorkout.dataset.id) {
        arr.splice(index, 1);
      }
      this._setLocalStorage();
    });
  }

  remove() {
    localStorage.removeItem('workouts'); // удаляем всё из локал сторадж
    location.reload(); // перезагружает страницу в браузере
  }
}
// Делаем обьект из класса App
const app = new App();
