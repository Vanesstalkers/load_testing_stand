function codeBlock(label, func){
    console.time(label);
    func();
    console.timeEnd(label);
}

/**
 * "Обертка"-helper для работы со списками (массивами)
 */
function listHelper(list = []) {

    const listClone = [...list];

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
 * "Обертка"-helper для работы с каталогами (объектами)
 */
function catalogHelper(catalog = {}){

    const catalogClone = {...catalog};

    /**
     * Получить хранимый в каталоге объект (с механикой кэширования)
     * @param {*} itemId идентификатор объекта в каталоге
     * @param {*} getFunc функция для получения объекта (если нет в кэше)
     * @returns объект каталога
     */
    catalogClone.get = function(itemId, getFunc){
        if(!this[itemId]){
            this[itemId] = getFunc();
        }
        return this[itemId];
    }

    return catalogClone;
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
const BASE_WEEK_TERM = 52;
const BASE_DAY_TERM = 365;

const AIRPORT_COUNT = 100;//1000;
const COMPANY_COUNT = 10;//2 + Math.ceil(Math.random() * 8); // количество компаний 3-10
const AIRCRAFT_IN_COMPANY_COUNT = 2;//100;

{   // САМОЛЕТЫ
    const aircraftList = data.addObjectList({
        type: 'aircraft'
    });
    const AIRCRAFT_COUNT = COMPANY_COUNT * AIRCRAFT_IN_COMPANY_COUNT; // количество самолетов [количество компаний]*100
    for (let i = 0; i < AIRCRAFT_COUNT; i++){
        aircraftList.add({ codeSfx: i });
    }
}
if(true){ // КОМПАНИИ
codeBlock('КОМПАНИИ-ВЛАДЕЛЬЦЫ', ()=>{
    const companyList = data.addObjectList({
        type: 'company'
    });
    for (let i = 0; i < COMPANY_COUNT; i++){
        companyList.add({ codeSfx: i });
    }
});
codeBlock('ПЕРВИЧНАЯ ПРИВЯЗКА САМОЛЕТОВ К КОМПАНИЯМ', ()=>{
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
});
codeBlock('ТРАНСФЕРЫ САМОЛЕТОВ МЕЖДУ КОМПАНИЯМИ В ТЕЧЕНИЕ ГОДА', ()=>{
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
});
codeBlock('ДЕПАРТАМЕНТЫ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ', ()=>{
    const companyDepartmentList = data.addObjectList({
        type: 'company_department', meta: {
            id_company: 'character(100) NOT NULL',
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    let counter = 0;

    for(const company of companyListItems){
        const companyId = company.getId();
        const DEPARTMENT_COUNT = 20;//9 + Math.ceil(Math.random() * 11); // количество компаний 10-20
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            counter++;
            const department = companyDepartmentList.add({ codeSfx: counter });
            department.setParent({ parent: company });
            department.id_company = companyId;
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ', ()=>{
    const companyDepartmentWorkerList = data.addObjectList({
        type: 'company_worker', meta: {
            id_department: 'character(100) NOT NULL',
        }
    });
    const companyDepartmentListItems = data.getObjectList({type: 'company_department'}).getItems();
    let counter = 0;
    
    for(const department of companyDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 50;//19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            counter++;
            const worker = companyDepartmentWorkerList.add({ codeSfx: counter });
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ ДЕЖУРНЫХ В КОМПАНИЯХ', ()=>{
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
});
codeBlock('СМЕНА ДЕЖУРНЫХ В КОМПАНИЯХ В ТЕЧЕНИЕ ГОДА', ()=>{
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const companyWorkerOdJournal = data.getJournal({name: 'company_worker_od_journal'});
    const companyWorkerCatalog = catalogHelper();
    for(const company of companyListItems){
        for (let t = 0; t < BASE_DAY_TERM; t++) { // период в течение которого (каждый день) происходили смены дежурных
            const workerList = companyWorkerCatalog.get(company.getId(), ()=>{
                const departmentList = company.getChildList({type: 'company_department'});
                return listHelper(
                    departmentList.reduce((acc, department)=>{
                        return acc.concat( department.getChildList({type: 'company_worker'}) )
                    }, [])
                );
            });
            const worker = workerList.getRandomItem();
            const workerDepartment = worker.getParent();
            companyWorkerOdJournal.add({
                add_time: t,
                id_department: workerDepartment.getId(),
                id_worker: worker.getId(),
            });
        }
    }
});
}
if(true){ // БАНКИ
codeBlock('БАНКИ', ()=>{
    const bankList = data.addObjectList({
        type: 'bank'
    });
    const BANK_COUNT = 10; // количество банков 10
    for (let i = 0; i < BANK_COUNT; i++){
        bankList.add({ codeSfx: i });
    }
});
codeBlock('ПРИВЯЗКА САМОЛЕТОВ К БАНКАМ', ()=>{
    const bankAircraftOwnJournal = data.addJournal({
        name: 'bank_aircraft_own_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_bank: 'character(100) NOT NULL',
            id_aircraft: 'character(100) NOT NULL',
        }
    });
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();

    bankListItems.queueStart();
    while (aircraftListItems.length) {
        const bank = bankListItems.queueNext();
        const aircraft = aircraftListItems.pullRandomItem();
        bankAircraftOwnJournal.add({
            add_time: -1,
            id_bank: bank.getId(),
            id_aircraft: aircraft.getId(),
        });
        aircraft.setParent({ parent: bank });
    }
});
codeBlock('ДЕПАРТАМЕНТЫ В БАНКАХ', ()=>{
    const bankDepartmentList = data.addObjectList({
        type: 'bank_department', meta: {
            id_bank: 'character(100) NOT NULL',
        }
    });
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();
    let counter = 0;

    for(const bank of bankListItems){
        const bankId = bank.getId();
        const DEPARTMENT_COUNT = 99 + Math.ceil(Math.random() * 51); // количество банков 100-150
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            counter++;
            const department = bankDepartmentList.add({ codeSfx: counter });
            department.setParent({ parent: bank });
            department.id_bank = bankId;
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В БАНКАХ', ()=>{
    const bankDepartmentWorkerList = data.addObjectList({
        type: 'bank_worker', meta: {
            id_department: 'character(100) NOT NULL',
        }
    });
    const bankDepartmentListItems = data.getObjectList({type: 'bank_department'}).getItems();
    let counter = 0;
    
    for(const department of bankDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            counter++;
            const worker = bankDepartmentWorkerList.add({ codeSfx: counter });
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ ДЕЖУРНЫХ В БАНКАХ', ()=>{
    const bankWorkerOdJournal = data.addJournal({
        name: 'bank_worker_od_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_department: 'character(100) NOT NULL',
            id_worker: 'character(100) NOT NULL',
        }
    });
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();
    for(const bank of bankListItems){
        const departmentList = bank.getChildList({type: 'bank_department'});
        const workerList = listHelper(
            departmentList.reduce((acc, department)=>{
                return acc.concat( department.getChildList({type: 'bank_worker'}) )
            }, [])
        );
        const worker = workerList.getRandomItem();
        const workerDepartment = worker.getParent();
        bankWorkerOdJournal.add({
            add_time: -1,
            id_department: workerDepartment.getId(),
            id_worker: worker.getId(),
        });
    }
});
codeBlock('СМЕНА ДЕЖУРНЫХ В БАНКАХ В ТЕЧЕНИЕ ГОДА', ()=>{
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();
    const bankWorkerOdJournal = data.getJournal({name: 'bank_worker_od_journal'});
    const bankWorkerCatalog = catalogHelper();
    for(const bank of bankListItems){
        for (let t = 0; t < BASE_DAY_TERM; t++) { // период в течение которого (каждый день) происходили смены дежурных
            const workerList = bankWorkerCatalog.get(bank.getId(), ()=>{
                const departmentList = bank.getChildList({type: 'bank_department'});
                return listHelper(
                    departmentList.reduce((acc, department)=>{
                        return acc.concat( department.getChildList({type: 'bank_worker'}) )
                    }, [])
                );
            });
            const worker = workerList.getRandomItem();
            const workerDepartment = worker.getParent();
            bankWorkerOdJournal.add({
                add_time: t,
                id_department: workerDepartment.getId(),
                id_worker: worker.getId(),
            });
        }
    }
});
}
if(true){ // АЭРОПОРТЫ
codeBlock('АЭРОПОРТЫ', ()=>{
    const airportList = data.addObjectList({
        type: 'airport'
    });
    for (let i = 0; i < AIRPORT_COUNT; i++){
        airportList.add({ codeSfx: i });
    }
});
codeBlock('ДЕПАРТАМЕНТЫ В АЭРОПОРТАХ', ()=>{
    const airportDepartmentList = data.addObjectList({
        type: 'airport_department', meta: {
            id_airport: 'character(100) NOT NULL',
        }
    });
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();
    let counter = 0;

    for(const airport of airportListItems){
        const airportId = airport.getId();
        const DEPARTMENT_COUNT = 9 + Math.ceil(Math.random() * 11); // количество компаний 10-20
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            counter++;
            const department = airportDepartmentList.add({ codeSfx: counter });
            department.setParent({ parent: airport });
            department.id_airport = airportId;
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В АЭРОПОРТАХ', ()=>{
    const airportDepartmentWorkerList = data.addObjectList({
        type: 'airport_worker', meta: {
            id_department: 'character(100) NOT NULL',
        }
    });
    const airportDepartmentListItems = data.getObjectList({type: 'airport_department'}).getItems();
    let counter = 0;
    
    for(const department of airportDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            counter++;
            const worker = airportDepartmentWorkerList.add({ codeSfx: counter });
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ НАЧАЛЬНИКОВ ДЕПАРТАМЕНТОВ В АЭРОПОРТАХ', ()=>{
    const airportWorkerOdJournal = data.addJournal({
        name: 'airport_department_worker_join_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_department: 'character(100) NOT NULL',
            id_worker: 'character(100) NOT NULL',
            role: 'character(100) NOT NULL',
        }
    });
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();
    for(const airport of airportListItems){
        const departmentList = airport.getChildList({type: 'airport_department'});
        for(const department of departmentList){
            const workerList = department.getChildList({type: 'airport_worker'});
            const headWorker = workerList.getRandomItem();
            for(const worker of workerList){
                worker.role = worker === headWorker ? 'head': 'engineer';
                airportWorkerOdJournal.add({
                    add_time: -1,
                    id_department: department.getId(),
                    id_worker: worker.getId(),
                    role: worker.role
                });
            }
        }
    }
});
codeBlock('СМЕНА НАЧАЛЬНИКОВ ДЕПАРТАМЕНТОВ В АЭРОПОРТАХ В ТЕЧЕНИЕ ГОДА', ()=>{
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();
    const airportWorkerOdJournal = data.getJournal({name: 'airport_department_worker_join_journal'});

    for(const airport of airportListItems){
        for (let t = 0; t < BASE_WEEK_TERM; t = t + 3) { // период в течение которого (каждые 3 недели) происходили смены начальников
            const departmentList = airport.getChildList({type: 'airport_department'});
            for(const department of departmentList){
                const workerList = department.getChildList({type: 'airport_worker'});
                const headWorkerNew = workerList.getRandomItem();
                const headWorkerOld = workerList.find(worker => worker.role === 'head');
                airportWorkerOdJournal.add({
                    add_time: t,
                    id_department: department.getId(),
                    id_worker: headWorkerOld.getId(),
                    role: 'engineer'
                });
                airportWorkerOdJournal.add({
                    add_time: t,
                    id_department: department.getId(),
                    id_worker: headWorkerNew.getId(),
                    role: 'head'
                });
            }
        }
    }
});
codeBlock('ПРИЛЕТЫ САМОЛЕТОВ В АЭРОПОРТЫ В ТЕЧЕНИЕ ГОДА (+ ИХ РЕМОНТ)', ()=>{
    
    const airportAircraftFlyJournal = data.addJournal({
        name: 'airport_aircraft_fly_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_airport: 'character(100) NOT NULL',
            id_aircraft: 'character(100) NOT NULL',
        }
    });
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();

    const aircraftWorkerRepairJournal = data.addJournal({
        name: 'aircraft_worker_repair_journal', meta: {
            add_time: 'bigint NOT NULL',
            id_aircraft: 'character(100) NOT NULL',
            id_worker: 'character(100) NOT NULL',
        }
    });
    const airportWorkerCatalog = catalogHelper();

    for(const aircraft of aircraftListItems){
        for (let t = 0; t < BASE_DAY_TERM; t++) { // период в течение которого (каждый день) происходили прилеты самолетов
            const airport = airportListItems.getRandomItem();
            airportAircraftFlyJournal.add({
                add_time: t,
                id_aircraft: aircraft.getId(),
                id_airport: airport.getId(),
            });

            const workerList = airportWorkerCatalog.get(airport.getId(), ()=>{
                const departmentList = airport.getChildList({type: 'airport_department'});
                return listHelper(
                    departmentList.reduce((acc, department)=>{
                        return acc.concat( department.getChildList({type: 'airport_worker'})
                                .filter(worker => worker.role != 'head') )
                    }, [])
                );
            });
            const worker = workerList.getRandomItem();
            aircraftWorkerRepairJournal.add({
                add_time: t,
                id_airport: airport.getId(),
                id_worker: worker.getId(),
            });
        }
    }
});
}

{   // ПРИМЕРЫ SQL-ЗАПРОСОВ
    /* самолеты, которые находились в одном и том же аэропорту несколько периодов подряд
        SELECT *
        FROM "airport_aircraft_fly_journal" a1
        LEFT JOIN "airport_aircraft_fly_journal" a2 
        ON a1.id_aircraft = a2.id_aircraft AND a1.id_airport = a2.id_airport AND a1.add_time + 1 = a2.add_time
        WHERE a2.id_aircraft IS NOT NULL
    */
    /* сотрудники, которые оставались начальниками несколько периодов подряд
        SELECT *
        FROM "airport_department_worker_join_journal" a1
        LEFT JOIN "airport_department_worker_join_journal" a2 
        ON a1.id_worker = a2.id_worker AND a1.id_department = a2.id_department AND a1.add_time + 1 = a2.add_time
        WHERE a2.id_worker IS NOT NULL AND a1.role = a2.role AND a1.role = 'head'
    */
}

console.log('data ready');
// console.log(JSON.stringify(data, 0, 2));
(async () => {
    const res = await data.fillPostgres();
    //console.log({res});
    console.log('db ready');
    process.exit(0);
})();