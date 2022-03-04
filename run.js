
const TYPES = {
    char100: {
        sql: 'character(100) NOT NULL',
        sqlRandom: 'md5(random()::text)',
    },
    bigint: {
        sql: 'bigint NOT NULL',
        sqlRandom: 'floor(random()*1000000)',
    }
}

function codeBlock(label, func){
    console.time(label);
    func();
    console.timeEnd(label);
}

function getPostgresClient(){
    const { Client } = require('pg');
    const client = new Client({ user: 'postgres', host: '127.0.0.1', database: 'load_test', password: 'postgres', port: 5432 });
    client.connect();
    return client;
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
    constructor({ type, codeSfx = '' } = {}) {
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
        id: TYPES.char100,
        code: TYPES.char100,
    };

    items = {};
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
     * Получить тип объектов в каталоге
     * @returns тип объектов в каталоге
     */
    getItemType(){
        return this.#itemType;
    }
    /**
     * Добавление нового объекта в каталог объектов
     * @param {*} data предустановленные значения объекта
     * @param {*} codeSfx суффикс к коду объекта
     * @returns добавленный объект
     */
    add({ data = {}, codeSfx = '' } = {}) {
        if(!codeSfx) codeSfx = Object.keys(this.items).length;
        const obj = new objectInstance({ type: this.#itemType, codeSfx });
        Object.assign(obj, data);
        this.items[obj.code] = obj;
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
        sql.push(`CREATE TABLE "` + this.#name + `" (` + Object.entries(meta).map(([key, value]) => `"${key}" ${value.sql} `).join(', ') + `)`);

        sql = sql.concat( this.insertItemsSQL() );

        return sql.join('; ');
    }
    /**
     * Сформировать insert-SQL для всех записей каталога
     * @param {*} fake или одну фейковую запись
     * @returns массив SQL-запросов
     */
    insertItemsSQL({fake} = {}) {
        const meta = this.getMeta();
        const sql = [];

        const items = Object.values(this.items);
        if (items.length) {
            const insert = [];
            if(fake){
                insert.push(`(` + Object.values(meta).map(randomValue => randomValue.sqlRandom) + `)`);
            }else{
                for (const item of items) {
                    insert.push(`(` + Object.keys(meta).map(key => `'${item[key]}'`) + `)`);
                }
            }
            sql.push(`INSERT INTO "` + this.#name + `" (` + Object.keys(meta).map(key => `"${key}"`) + `) VALUES ` + insert.join(', '));
        }

        return sql;
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
        sql.push(`CREATE TABLE "` + this.#name + `" (` + Object.entries(meta).map(([key, value]) => `"${key}" ${value.sql} `).join(', ') + `)`);

        sql = sql.concat( this.insertItemsSQL() );

        return sql.join('; ');
    }
    /**
     * Сформировать insert-SQL для всех записей каталога
     * @param {*} fake или одну фейковую запись
     * @returns массив SQL-запросов
     */
    insertItemsSQL({fake} = {}) {
        const meta = this.getMeta();
        const sql = [];

        const items = Object.values(this.items);
        if (items.length) {
            const insert = [];
            if(fake){
                insert.push(`(` + Object.values(meta).map(randomValue => randomValue.sqlRandom) + `)`);
            }else{
                for (const item of items) {
                    insert.push(`(` + Object.keys(meta).map(key => `'${item[key]}'`) + `)`);
                }
            }
            sql.push(`INSERT INTO "` + this.#name + `" (` + Object.keys(meta).map(key => `"${key}"`) + `) VALUES ` + insert.join(', '));
        }

        return sql;
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
    /**
     * Подключиться к Postgres и наполнить ее
     * @returns ответ из БД
     */
    async fillPostgres() {
        const client = getPostgresClient();
        return await client.query(this.createSQL());
    }
    async fillPostgresWithFakeData({size = 0} = {}) {
        const client = getPostgresClient();
        const result = [];
        for await (const item of Object.values(this)) {
            const sql = [];
            for(let j = 0; j < size; j++){
                sql.push( item.insertItemsSQL({fake: true}) );
            }
            const queryResult = await client.query( sql.join('; ') );
            result.push( queryResult );
            console.log(`В каталог "${item.getItemType()}" добавлено ${size} блоков с fake-данными.`);
        }
        return result;
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
        aircraftList.add();
    }
}
if(true){ // КОМПАНИИ
codeBlock('КОМПАНИИ-ВЛАДЕЛЬЦЫ', ()=>{
    const companyList = data.addObjectList({
        type: 'company'
    });
    for (let i = 0; i < COMPANY_COUNT; i++){
        companyList.add();
    }
});
codeBlock('ПЕРВИЧНАЯ ПРИВЯЗКА САМОЛЕТОВ К КОМПАНИЯМ', ()=>{
    const companyAircraftOwnJournal = data.addObjectList({
        type: 'company_aircraft_own_journal', meta: {
            add_time: TYPES.bigint,
            id_company: TYPES.char100,
            id_aircraft: TYPES.char100,
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();

    companyListItems.queueStart();
    while (aircraftListItems.length) {
        const company = companyListItems.queueNext();
        const aircraft = aircraftListItems.pullRandomItem();
        companyAircraftOwnJournal.add({data:{
            add_time: -1,
            id_company: company.getId(),
            id_aircraft: aircraft.getId(),
        }});
        aircraft.setParent({ parent: company });
    }
});
codeBlock('ТРАНСФЕРЫ САМОЛЕТОВ МЕЖДУ КОМПАНИЯМИ В ТЕЧЕНИЕ ГОДА', ()=>{
    const AIRCRAFT_PER_MONTH_TRANSFERRED_COUNT = AIRCRAFT_IN_COMPANY_COUNT;
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const companyAircraftOwnJournal = data.getObjectList({type: 'company_aircraft_own_journal'});

    for (let t = 0; t < BASE_MONTH_TERM; t++) { // период в течение которого (каждый месяц) происходили перемещения самолетов
        const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();
        for (let i = 0; i < AIRCRAFT_PER_MONTH_TRANSFERRED_COUNT; i++) {
            const company = companyListItems.getRandomItem();
            const aircraft = aircraftListItems.pullRandomItem();
            companyAircraftOwnJournal.add({data: {
                add_time: t,
                id_company: company.getId(),
                id_aircraft: aircraft.getId(),
            }});
            aircraft.setParent({ parent: company });
        }
    }
});
codeBlock('ДЕПАРТАМЕНТЫ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ', ()=>{
    const companyDepartmentList = data.addObjectList({
        type: 'company_department', meta: {
            id_company: TYPES.char100,
        }
    });
    const companyListItems = data.getObjectList({type: 'company'}).getItems();

    for(const company of companyListItems){
        const companyId = company.getId();
        const DEPARTMENT_COUNT = 20;//9 + Math.ceil(Math.random() * 11); // количество компаний 10-20
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            const department = companyDepartmentList.add({data: {
                id_company: companyId,
            }});
            department.setParent({ parent: company });
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В КОМПАНИЯХ-ВЛАДЕЛЬЦАХ', ()=>{
    const companyDepartmentWorkerList = data.addObjectList({
        type: 'company_worker', meta: {
            id_department: TYPES.char100,
        }
    });
    const companyDepartmentListItems = data.getObjectList({type: 'company_department'}).getItems();
    
    for(const department of companyDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 10;//19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            const worker = companyDepartmentWorkerList.add({data:{
                id_department: departmentId,
            }});
            worker.setParent({ parent: department });
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ ДЕЖУРНЫХ В КОМПАНИЯХ', ()=>{
    const companyWorkerOdJournal = data.addObjectList({
        type: 'company_worker_od_journal', meta: {
            add_time: TYPES.bigint,
            id_department: TYPES.char100,
            id_worker: TYPES.char100,
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
        companyWorkerOdJournal.add({data:{
            add_time: -1,
            id_department: workerDepartment.getId(),
            id_worker: worker.getId(),
        }});
    }
});
codeBlock('СМЕНА ДЕЖУРНЫХ В КОМПАНИЯХ В ТЕЧЕНИЕ ГОДА', ()=>{
    const companyListItems = data.getObjectList({type: 'company'}).getItems();
    const companyWorkerOdJournal = data.getObjectList({type: 'company_worker_od_journal'});
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
            companyWorkerOdJournal.add({data:{
                add_time: t,
                id_department: workerDepartment.getId(),
                id_worker: worker.getId(),
            }});
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
        bankList.add();
    }
});
codeBlock('ПРИВЯЗКА САМОЛЕТОВ К БАНКАМ', ()=>{
    const bankAircraftOwnJournal = data.addObjectList({
        type: 'bank_aircraft_own_journal', meta: {
            add_time: TYPES.bigint,
            id_bank: TYPES.char100,
            id_aircraft: TYPES.char100,
        }
    });
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();

    bankListItems.queueStart();
    while (aircraftListItems.length) {
        const bank = bankListItems.queueNext();
        const aircraft = aircraftListItems.pullRandomItem();
        bankAircraftOwnJournal.add({data: {
            add_time: -1,
            id_bank: bank.getId(),
            id_aircraft: aircraft.getId(),
        }});
        aircraft.setParent({ parent: bank });
    }
});
codeBlock('ДЕПАРТАМЕНТЫ В БАНКАХ', ()=>{
    const bankDepartmentList = data.addObjectList({
        type: 'bank_department', meta: {
            id_bank: TYPES.char100,
        }
    });
    const bankListItems = data.getObjectList({type: 'bank'}).getItems();

    for(const bank of bankListItems){
        const bankId = bank.getId();
        const DEPARTMENT_COUNT = 10;//99 + Math.ceil(Math.random() * 51); // количество банков 100-150
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            const department = bankDepartmentList.add();
            department.setParent({ parent: bank });
            department.id_bank = bankId;
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В БАНКАХ', ()=>{
    const bankDepartmentWorkerList = data.addObjectList({
        type: 'bank_worker', meta: {
            id_department: TYPES.char100,
        }
    });
    const bankDepartmentListItems = data.getObjectList({type: 'bank_department'}).getItems();
    
    for(const department of bankDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 10;//19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            const worker = bankDepartmentWorkerList.add();
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ ДЕЖУРНЫХ В БАНКАХ', ()=>{
    const bankWorkerOdJournal = data.addObjectList({
        type: 'bank_worker_od_journal', meta: {
            add_time: TYPES.bigint,
            id_department: TYPES.char100,
            id_worker: TYPES.char100,
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
    const bankWorkerOdJournal = data.getObjectList({type: 'bank_worker_od_journal'});
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
        airportList.add();
    }
});
codeBlock('ДЕПАРТАМЕНТЫ В АЭРОПОРТАХ', ()=>{
    const airportDepartmentList = data.addObjectList({
        type: 'airport_department', meta: {
            id_airport: TYPES.char100,
        }
    });
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();

    for(const airport of airportListItems){
        const airportId = airport.getId();
        const DEPARTMENT_COUNT = 9 + Math.ceil(Math.random() * 11); // количество компаний 10-20
        for (let i = 0; i < DEPARTMENT_COUNT; i++){
            const department = airportDepartmentList.add();
            department.setParent({ parent: airport });
            department.id_airport = airportId;
        }    
    }
});
codeBlock('СОТРУДНИКИ В ДЕПАРТАМЕНТАХ В АЭРОПОРТАХ', ()=>{
    const airportDepartmentWorkerList = data.addObjectList({
        type: 'airport_worker', meta: {
            id_department: TYPES.char100,
        }
    });
    const airportDepartmentListItems = data.getObjectList({type: 'airport_department'}).getItems();
    
    for(const department of airportDepartmentListItems){
        const departmentId = department.getId();
        const WORKER_COUNT = 10;//19 + Math.ceil(Math.random() * 31); // количество компаний 20-50
        for (let i = 0; i < WORKER_COUNT; i++){
            const worker = airportDepartmentWorkerList.add();
            worker.setParent({ parent: department });
            worker.id_department = departmentId;
        }    
    }
});
codeBlock('ПЕРВИЧНОЕ НАЗНАЧЕНИЕ НАЧАЛЬНИКОВ ДЕПАРТАМЕНТОВ В АЭРОПОРТАХ', ()=>{
    const airportWorkerOdJournal = data.addObjectList({
        type: 'airport_department_worker_join_journal', meta: {
            add_time: TYPES.bigint,
            id_department: TYPES.char100,
            id_worker: TYPES.char100,
            role: TYPES.char100,
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
    const airportWorkerOdJournal = data.getObjectList({type: 'airport_department_worker_join_journal'});

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
    
    const airportAircraftFlyJournal = data.addObjectList({
        type: 'airport_aircraft_fly_journal', meta: {
            add_time: TYPES.bigint,
            id_airport: TYPES.char100,
            id_aircraft: TYPES.char100,
        }
    });
    const aircraftListItems = data.getObjectList({type: 'aircraft'}).getItems();
    const airportListItems = data.getObjectList({type: 'airport'}).getItems();

    const aircraftWorkerRepairJournal = data.addObjectList({
        type: 'aircraft_worker_repair_journal', meta: {
            add_time: TYPES.bigint,
            id_aircraft: TYPES.char100,
            id_worker: TYPES.char100,
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
                id_aircraft: aircraft.getId(),
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
    //for await (const i of Array(10)) {
        await data.fillPostgresWithFakeData({size: 10});
    //}
    //console.log({res});
    console.log('db ready');
    process.exit(0);
})();