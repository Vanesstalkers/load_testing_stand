/**
 * Обертка-helper для работы со списками
 */
 function listHelper(list) {

    const listClone = [].concat(list);

    listClone._queueIndex = null;
    /**
     * Получить случайный элемент списка
     * @returns элемент списка
     */
    listClone.getRandomItem = function () {
        return this[Math.floor(Math.random() * this.length)];
    }
    /**
     * Извлечь случайный элемент списка (с удалением из списка)
     * @returns элемент списка
     */
    listClone.pullRandomItem = function () {
        return this.splice(Math.floor(Math.random() * this.length), 1)[0];
    }
    /**
     * Инициировать механизм очереди
     */
    listClone.queueStart = function () {
        this._queueIndex = -1;
    }
    /**
     * Получить следующий элемент списка в очереди
     * @returns элемент списка
     */
    listClone.queueNext = function () {
        this._queueIndex++;
        if (this._queueIndex >= this.length) this._queueIndex = 0;
        return this[this._queueIndex];
    }

    return listClone;
}

/**
 * Объект
 */
class objectInstance {
    #type;
    #parent = undefined;
    #childList = [];

    id;
    code;
    /**
     * Экземпляр объекта
     * @param {*} type тип объекта
     * @param {*} codeSfx суффикс к коду объекта
     */
    constructor({ type, codeSfx } = {}) {
        this.#type = type;
        this.code = type + codeSfx.toString();
        this.id = this.code;
    }
    /**
     * Установить кастомное значение
     * @param {*} attr
     * @param {*} value
     */
    setData(attr, value) {
        this[attr] = value;
    }
    /**
     * Проверить совпадение типа объекта
     * @returns true/false
     */
    typeMatches(type) {
        return this.#type === type;
    }
    /**
     * Получить идентификатор объекта
     * @returns идентификатор объекта
     */
    getId() {
        return this.id;
    }
    /**
     * Установить ссылку на родителя объекта
     * @param {*} parent ссылка на родителя 
     */
    setParent({ parent }) {
        if (this.#parent) this.#parent.removeChild({ child: this });
        this.#parent = parent;
        this.#parent.addChild({ child: this });
    }
    /**
     * Получить ссылку на родителя
     * @returns ссылка на родителя
     */
    getParent() {
        return this.#parent;
    }
    /**
     * Добавить ребенка в список детей
     * @param {*} child ссылка на ребенка 
     */
    addChild({ child }) {
        this.#childList.push(child);
    }
    /**
     * Удалить ребенка из списка детей
     * @param {*} child ссылка на ребенка 
     */
    removeChild({ child }) {
        const childId = child.getId();
        this.#childList = this.#childList.filter(childItem => childItem.getId() !== childId);
    }
    /**
     * Получить список детей
     * @param {*} type тип ребенка 
     * @returns список детей
     */
    getChildList({type}){
        const childList = this.#childList.filter(childItem => childItem.typeMatches(type));
        return listHelper( childList );
    }
}
/**
 * Каталог объектов конкретного типа внутри хранилища
 */
class fillDataObjectList {
    #name;
    #itemType;
    #itemMeta = {
        id: 'character(100) NOT NULL',
        code: 'character(100) NOT NULL',
    };

    items = {};
    itemsLength = 0;
    /**
     * Экземпляр каталога объектов
     * @param {*} type тип объектов в каталоге
     */
    constructor({ type, meta = {} } = {}) {
        this.#name = type;
        this.#itemType = type;
        Object.assign(this.#itemMeta, meta);
    }
    /**
     * Добавление нового объекта в каталог объектов
     * @param {*} codeSfx суффикс к коду объекта
     * @returns добавленный объект
     */
    add({ codeSfx }) {
        const obj = new objectInstance({ type: this.#itemType, codeSfx });
        this.items[obj.code] = obj;
        this.itemsLength++;
        return obj;
    }
    /**
     * Получить идентификатор объекта в каталоге по коду объекта
     * @param {*} code код объекта
     * @returns идентификатор объекта
     */
    getIdByCode({ code }) {
        return this.items[code].getId();
    }
    /**
     * Получить список ключей всех объектов каталога
     * @returns список ключей, обернутый в listHelper
     */
    getKeys() {
        return listHelper(Object.keys(this.items));
    }
    /**
     * Получить список ссылок на все объекты каталога
     * @returns список ссылок на объекты, обернутый в listHelper
     */
    getItems() {
        return listHelper(Object.values(this.items));
    }
    /**
     * Получить мета-данные для объектов каталога
     * @returns мета-данные объектов каталога
     */
    getMeta() {
        return this.#itemMeta;
    }
    /**
     * Сформировать SQL для записи каталога в БД
     * @returns сформированный SQL
     */
    toSQL() {
        const meta = this.getMeta();
        let sql = [];

        sql.push(`DROP TABLE IF EXISTS "` + this.#name + `"`);
        sql.push(`CREATE TABLE "` + this.#name + `" (` + Object.entries(meta).map(entry => '"' + entry.join('" ')).join(', ') + `)`);

        const items = Object.values(this.items);
        if (items.length) {
            const insert = [];
            for (const item of items) {
                insert.push(`(` + Object.keys(meta).map(key => `'${item[key]}'`) + `)`);
            }
            sql.push(`INSERT INTO "` + this.#name + `" (` + Object.keys(meta).map(key => `"${key}"`) + `) VALUES ` + insert.join(', '));
        }

        return sql.join('; ');
    }
}
/**
 * Журнал произвольных записей внутри хранилиша
 */
class fillDataJournal {
    #name;
    #itemMeta = {};

    items = [];
    /**
     * Экземпляр журнала
     * @param {*} name наименование журнала 
     * @param {*} meta мета-данные записей журнала
     */
    constructor({ name, meta } = {}) {
        this.#name = name;
        this.#itemMeta = meta;
    }
    /**
     * Добавить записи в журнал
     * @param {*} item произвольная запись
     */
    add(item) {
        this.items.push(item);
    }
    /**
     * Получить мета-данные записей журнала
     * @returns мета-данные записей журнала
     */
    getMeta() {
        return this.#itemMeta;
    }
    /**
     * Сформировать SQL для записи журнала в БД
     * @returns сформированный SQL
     */

    toSQL() {
        const meta = this.getMeta();
        let sql = [];

        sql.push(`DROP TABLE IF EXISTS "` + this.#name + `"`);
        sql.push(`CREATE TABLE "` + this.#name + `" (` + Object.entries(meta).map(entry => '"' + entry.join('" ')).join(', ') + `)`);

        const items = Object.values(this.items);
        if (items.length) {
            const insert = [];
            for (const item of items) {
                insert.push(`(` + Object.keys(meta).map(key => `'${item[key]}'`) + `)`);
            }
            sql.push(`INSERT INTO "` + this.#name + `" (` + Object.keys(meta).map(key => `"${key}"`) + `) VALUES ` + insert.join(', '));
        }

        return sql.join('; ');
    }
}

/**
 * базовое хранилище данных
 */
class fillData {
    /**
     * Добавить новый каталог объектов
     * @param {*} type тип добавляемого каталога объектов
     * @returns ссылка на созданный каталог объектов
     */
    addObjectList({ type, meta }) {
        this[type] = new fillDataObjectList({ type, meta });
        return this.getObjectList({ type });
    }
    /**
     * Получить каталог по типу объектов
     * @param {*} type тип каталога объектов
     * @returns ссылка на каталог объектов
     */
    getObjectList({ type }) {
        return this[type];
    }
    /**
     * Получить список ключей всех объектов внутри каталога по типу каталога
     * @param {*} type тип каталога 
     * @returns список ключей объектов
     */
    getObjectListIds({ type }) {
        return this[type].getKeys();
    }
    /**
     * Добавить новый журнал в хранилище
     * @param {*} name наименование журнала 
     * @param {*} meta мета-данные записей журнала
     * @returns 
     */
    addJournal({ name, meta }) {
        this[name] = new fillDataJournal({ name, meta });
        return this[name];
    }
    /**
     * Получить каталог по типу объектов
     * @param {*} type тип каталога объектов
     * @returns ссылка на каталог объектов
     */
    getJournal({ name }) {
        return this[name];
    }

    /**
     * Сформировать SQL для записи хранилища в БД.
     * @returns сформированный SQL
     */
    createSQL() {
        let sql = [];
        for (const item of Object.values(this)) {
            sql.push(item.toSQL());
        };
        return sql.join('; ');
    }
    async fillPostgres() {
        const { Client } = require('pg');
        const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'load_test', password: 'postgres', port: 5432 });
        client.connect();
        return await client.query(this.createSQL());
    }
}

const data = new fillData();
const BASE_MONTH_TERM = 12;
const BASE_DAY_TERM = 365;
const AIRCRAFT_IN_COMPANY_COUNT = 2;//100;

{   // КОМПАНИИ-ВЛАДЕЛЬЦЫ
    const companyList = data.addObjectList({
        type: 'company'
    });
    const COMPANY_COUNT = 2 + Math.ceil(Math.random() * 8); // количество компаний 3-10
    for (let i = 0; i < COMPANY_COUNT; i++){
        companyList.add({ codeSfx: i });
    }
}
{   // САМОЛЕТЫ
    const aircraftList = data.addObjectList({
        type: 'aircraft'
    });
    const COMPANY_COUNT = data.getObjectList({type: 'company'}).getItems().length;
    const AIRCRAFT_COUNT = COMPANY_COUNT * AIRCRAFT_IN_COMPANY_COUNT; // количество самолетов [количество компаний]*100
    for (let i = 0; i < AIRCRAFT_COUNT; i++){
        aircraftList.add({ codeSfx: i });
    }
}
{   // ПЕРВИЧНАЯ ПРИВЯЗКА САМОЛЕТОВ К КОМПАНИЯМ
    const companyAircraftOwnJournal = data.addJournal({
        name: 'company_aircraft_own_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_company: 'character(100) NOT NULL',
            id_aircraft: 'character(100) NOT NULL',
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();

    companyListItems.queueStart();
    while (aircraftListItems.length) {
        const company = companyListItems.queueNext();
        const aircraft = aircraftListItems.pullRandomItem();
        companyAircraftOwnJournal.add({
            add_time: -1,
            id_company: company.getId(),
            id_aircraft: aircraft.getId(),
        });
        aircraft.setParent({ parent: company });
    }
}
{   // ТРАНСФЕРЫ САМОЛЕТОВ МЕЖДУ КОМПАНИЯМИ В ТЕЧЕНИЕ ГОДА
    const AIRCRAFT_PER_MONTH_TRANSFERRED_COUNT = AIRCRAFT_IN_COMPANY_COUNT;
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const companyAircraftOwnJournal = data.getJournal({name: 'company_aircraft_own_journal'});

    for (let t = 0; t < BASE_MONTH_TERM; t++) { // период в течение которого (каждый месяц) происходили перемещения самолетов
        const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();
        for (let i = 0; i < AIRCRAFT_PER_MONTH_TRANSFERRED_COUNT; i++) {
            const company = companyListItems.getRandomItem();
            const aircraft = aircraftListItems.pullRandomItem();
            companyAircraftOwnJournal.add({
                add_time: t,
                id_company: company.getId(),
                id_aircraft: aircraft.getId(),
            });
            aircraft.setParent({ parent: company });
        }
    }
}
{   // ДЕПАРТАМЕНТЫ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ
    const companyDepartmentList = data.addObjectList({
        type: 'company_department', meta: {
            id_company: 'character(100) NOT NULL',
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    let counter = 0;

    for(const company of companyListItems){
        const companyId = company.getId();
        const DEPARTMENT_COUNT = 9 + Math.ceil(Math.random() * 11); // количество компаний 10-20
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            counter++;
            const department = companyDepartmentList.add({ codeSfx: counter });
            department.setParent({ parent: company });
            department.id_company = companyId;
        }    
    }
}
{   // СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ
    const companyDepartmentWorkerList = data.addObjectList({
        type: 'company_worker', meta: {
            id_department: 'character(100) NOT NULL',
        }
    });
    const companyDepartmentListItems = data.getObjectList({type: 'company_department'}).getItems();
    let counter = 0;
    
    for(const department of companyDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            counter++;
            const worker = companyDepartmentWorkerList.add({ codeSfx: counter });
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
}
{   // ПЕРВИЧНОЕ НАЗНАЧЕНИЕ ДЕЖУРНЫХ В КОМПАНИЯХ
    const companyWorkerOdJournal = data.addJournal({
        name: 'company_worker_od_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_department: 'character(100) NOT NULL',
            id_worker: 'character(100) NOT NULL',
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    for(const company of companyListItems){
        const departmentList = company.getChildList({type: 'company_department'});
        const workerList = listHelper(
            departmentList.reduce((acc, department)=>{
                return acc.concat( department.getChildList({type: 'company_worker'}) )
            }, [])
        );
        const worker = workerList.getRandomItem();
        const workerDepartment = worker.getParent();
        companyWorkerOdJournal.add({
            add_time: -1,
            id_department: workerDepartment.getId(),
            id_worker: worker.getId(),
        });
    }
}
{   // СМЕНА ДЕЖУРНЫХ В КОМПАНИЯХ В ТЕЧЕНИЕ ГОДА
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const companyWorkerOdJournal = data.getJournal({name: 'company_worker_od_journal'});

    for(const company of companyListItems){
        for (let t = 0; t < BASE_DAY_TERM; t++) { // период в течение которого (каждый день) происходили смены дежурных
            const departmentList = company.getChildList({type: 'company_department'});
            const workerList = listHelper(
                departmentList.reduce((acc, department)=>{
                    return acc.concat( department.getChildList({type: 'company_worker'}) )
                }, [])
            );
            const worker = workerList.getRandomItem();
            const workerDepartment = worker.getParent();
            companyWorkerOdJournal.add({
                add_time: t,
                id_department: workerDepartment.getId(),
                id_worker: worker.getId(),
            });
        }
    }
}

console.log('ready');
// console.log(JSON.stringify(data, 0, 2));
(async () => {
    const res = await data.fillPostgres();
    console.log({res});
    process.exit(0);
})();