class RichTable {
  constructor(id, options = {}) {
    this.container = document.querySelector(id);
    this.tableContainer = null;

    this.copyData = [];
    this.copied = false;

    this.menuOptions = {
      INSERT_RIGHT: { label: "向右插入", role: "insert-right" },
      INSERT_DOWN: { label: "向下插入", role: "insert-down" },
      DELETE_COL: { label: "删除当前列", role: "delete-col" },
      DELETE_ROW: { label: "删除当前行", role: "delete-row" },
      COMBINE_CELL: { label: "合并单元格", role: "combine-cell" },
      SPLIT_CELL: { label: "拆分单元格", role: "split-cell" },
      COPY: { label: "复制", role: "copy" },
      PASTE: { label: "粘贴", role: "paste" },
      CLEAN: { label: "清空", role: "clean" },
    };

    const initOptions = {
      header: ["head1", "head2"],
      combineStyle: "all",
      cellWidth: 200,
    };

    this.options = {
      ...initOptions,
      ...options,
    };

    this.tableInfo = {
      row: 1,
      col: this.options.headers.length,
    };

    this.initTable(this.options);
  }

  initTable() {
    // 初始化 table
    this.tableContainer = document.createElement("table");
    this.container.appendChild(this.tableContainer);
    this.resetTableWidth();

    // 添加表头
    const thead = document.createElement("thead");
    this.createRow(thead, 0, "thead");
    this.tableContainer.appendChild(thead);

    // 表体默认增加一行
    const tbody = document.createElement("tbody");
    this.createRow(tbody, 0);
    this.tableContainer.appendChild(tbody);

    // 初始化右键菜单
    this.menu = new RightMouseButtonMenu();

    // 初始化拖动圈选器
    this.dragger = new Dragger(this.tableContainer);
    this.dragger.onDragStart = () => {
      this.menu.hideMenu();
    };

    this.initRightMouseBtnInterceptor();
    this.initShortcutKey();
  }

  // 阻止鼠标右键默认事件
  initRightMouseBtnInterceptor() {
    // 阻止右键点默认的击事件
    this.tableContainer.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      const { clientX, clientY } = e;
      const { id, row, col } = getCellInfo(this.tableContainer, e);
      const inDragArea = this.dragger.info.cellIdArr.includes(id);

      const {
        COPY,
        PASTE,
        CLEAN,
        INSERT_RIGHT,
        INSERT_DOWN,
        DELETE_ROW,
        DELETE_COL,
        COMBINE_CELL,
        SPLIT_CELL,
      } = this.menuOptions;

      const menuOptions = [
        COPY,
        PASTE,
        CLEAN,
        INSERT_RIGHT,
        INSERT_DOWN,
        DELETE_COL,
        DELETE_ROW,
      ];

      if (inDragArea) {
        menuOptions.unshift(COMBINE_CELL, SPLIT_CELL);
      }

      this.menu.showMenu(clientX, clientY, menuOptions);

      this.menu.addMenuEventListener((eventType, value) => {
        const [action, type] = eventType.split("-");
        if (action === "insert") {
          this.insertRowOrCol(type, { row, col }, value);
        }

        if (action === "delete") {
          this.deleteRowOrCol(type, { row, col });
        }

        if (eventType === COMBINE_CELL.role) {
          this.combineCell("combine", this.dragger.info);
        }

        if (eventType === SPLIT_CELL.role) {
          this.splitCell(e);
        }

        if (eventType === CLEAN.role) {
          this.dragger.info.cellArr.forEach((cell) => {
            cell.innerText = "";
          });
        }

        if (eventType === COPY.role) {
          this.copyCell(this.dragger.info);
        }

        if (eventType === PASTE.role) {
          this.pasteCell(this.dragger.info);
        }

        this.menu.hideMenu();
      });
    });
  }

  // 设置快捷键
  initShortcutKey() {
    const startKey = "Meta"; // ctrl(windows)/command(macos)
    let combining = false;

    const triggerMethods = (key) => {
      console.log(key);
      if (key === "c") {
        this.copyCell(this.dragger.info);
        return;
      }

      if (key === "v") {
        this.pasteCell(this.dragger.info);
        return;
      }
    };

    this.tableContainer.addEventListener("keydown", (e) => {
      if (combining === true) {
        e.preventDefault();
        combining = false;
        triggerMethods(e.key);
      } else {
        e.key === startKey && (combining = true);
      }
    });
  }

  // 表格插入
  insertRowOrCol(direction, cellLocation, value) {
    const { row, col } = cellLocation;

    if (direction === "right") {
      const theadRow = this.tableContainer.querySelector("thead tr");
      const tbodyRows = this.tableContainer.querySelectorAll("tbody tr");

      [theadRow, ...tbodyRows].forEach((tbodyRow) => {
        for (let i = 1; i <= value; i++) {
          this.createCell(tbodyRow, col + i, "");
        }
      });

      this.tableInfo.col = this.tableInfo.col + value;
      this.resetTableWidth();

      return;
    }

    if (direction === "down") {
      const tbody = this.tableContainer.querySelector("tbody");

      for (let i = 1; i <= value; i++) {
        this.createRow(tbody, row + i);
      }

      this.tableInfo.row = this.tableInfo.row + value;
    }
  }

  // 表格删除
  deleteRowOrCol(direction, cellLocation) {
    const { row, col } = cellLocation;

    if (direction === "row") {
      const tbody = this.tableContainer.querySelector("tbody");
      tbody.deleteRow(row);

      this.tableInfo.row = this.tableInfo.row + 1;

      return;
    }

    if (direction === "col") {
      const theadRow = this.tableContainer.querySelector("thead tr");
      const tbodyRows = this.tableContainer.querySelectorAll("tbody tr");

      [theadRow, ...tbodyRows].forEach((tbodyRow) => {
        tbodyRow.deleteCell(col);
      });

      this.tableInfo.col = this.tableInfo.col - 1;

      this.resetTableWidth();
    }
  }

  // 合并单元格
  combineCell(type, dragInfo) {
    const { row: startRow, col: startCol } = dragInfo.startPoint;
    const { row: endRow, col: endCol } = dragInfo.endPoint;

    const startPoint = {
      row: Math.min(startRow, endRow),
      col: Math.min(startCol, endCol),
    };

    const startCell = this.tableContainer
      .querySelectorAll("tbody tr")
      [startPoint.row].querySelectorAll("td")[startPoint.col];
    const { id: startCellId } = getCellInfo(this.tableContainer, startCell);

    const cells = Object.values(dragInfo.cellMap);

    const rowspan =
      this.options.combineStyle === "column" ? 1 : endRow - startRow + 1;
    const colspan =
      this.options.combineStyle === "row" ? 1 : endCol - startCol + 1;
    startCell.setAttribute("rowspan", rowspan);
    startCell.setAttribute("data-rowspan", rowspan);
    startCell.setAttribute("colspan", colspan);
    startCell.setAttribute("data-colspan", colspan);

    cells
      .filter((cell) => {
        const combineStyle = this.options.combineStyle;
        const { row, col } = getCellInfo(this.tableContainer, cell);

        switch (combineStyle) {
          case "column":
            return row === startPoint.row;
          case "row":
            return col === startPoint.col;
          default:
            return true;
        }

        // if (combineStyle === "column") return row === startPoint.row;

        // if (combineStyle === "row") return col === startPoint.col;

        // return true;
      })
      .forEach((cell) => {
        const { id } = getCellInfo(this.tableContainer, cell);
        if (id !== startCellId) {
          cell.innerText = "";
          cell.classList.add("placeholder");
        }
      });
  }

  // 拆分单元格
  splitCell(e) {
    const currCell = e.target;
    const { rowspan, colspan, row, col } = getCellInfo(this.tableContainer, e);

    currCell.setAttribute("rowspan", 1);
    currCell.setAttribute("colspan", 1);

    const tableRows = this.tableContainer.querySelectorAll("tbody tr");

    for (let i = 0; i < rowspan; i++) {
      const currTableRow = tableRows[row + i];

      for (let j = 0; j < colspan; j++) {
        if (!(i === 0 && j === 0)) {
          const cell = currTableRow.querySelectorAll("td")[col + j];
          cell.classList.remove("placeholder");
        }
      }
    }
  }

  // 复制单元格
  copyCell(draggerInfo) {
    this.copyData = [];

    const {
      startPoint: { row: startRow, col: startCol },
      endPoint: { row: endRow, col: endCol },
    } = draggerInfo;

    for (let row = startRow; row <= endRow; row++) {
      const tbodyRow = this.tableContainer.querySelectorAll("tbody tr")[row];
      const cells = tbodyRow.querySelectorAll("td");

      const rowData = [];

      for (let col = startCol; col <= endCol; col++) {
        const cell = cells[col];

        const { rowspan, colspan, value, className } = getCellInfo(
          this.tableContainer,
          cell
        );

        rowData.push({
          rowspan,
          colspan,
          value,
          className,
        });
      }

      this.copyData.push(rowData);
    }

    this.copied = true;

    console.log("copied: ", this.copyData);
  }

  // 粘贴单元格
  pasteCell(draggerInfo) {
    const {
      startPoint: { row, col },
    } = draggerInfo;
    const tableRows = this.tableContainer.querySelectorAll("tbody tr");

    for (let i = 0, iLen = this.copyData.length; i < iLen; i++) {
      const tableRow = tableRows[row + i];
      const cells = tableRow.querySelectorAll("td");

      for (let j = 0, jLen = this.copyData[i].length; j < jLen; j++) {
        const cell = cells[col + j];

        if (cell) {
          const { rowspan, colspan, value, className } = this.copyData[i][j];

          cell.setAttribute("rowspan", rowspan);
          cell.setAttribute("colspan", colspan);
          cell.setAttribute("data-rowspan", rowspan);
          cell.setAttribute("data-colspan", colspan);
          cell.className = className;
          // 清空单元格高亮
          cell.classList.remove("highlight");
          cell.innerText = value;
        }
      }
    }
    this.copied = false;
  }

  createCell(tbodyRow, index, content = "") {
    const cell = tbodyRow.insertCell(index);
    cell.setAttribute("contenteditable", true);
    cell.setAttribute("data-id", getUuidCode());
    cell.innerText = content;
    cell.style.width = this.options.cellWidth + "px";

    return cell;
  }

  createRow(container, index, location) {
    const row = container.insertRow(index);

    for (let j = 0; j < this.tableInfo.col; j++) {
      const cellContent = location === "thead" ? this.options.headers[j] : "";
      this.createCell(row, j, cellContent);
    }

    return row;
  }

  resetTableWidth() {
    this.tableContainer.style.width =
      this.tableInfo.col * this.options.cellWidth + "px";
  }

  getData() {}
}

// 拖动圈选器
class Dragger {
  constructor(container) {
    this.tableContainer = container;
    this.__mouse_drag_info__ = {
      startPoint: { row: 0, col: 0 },
      endPoint: { row: 0, col: 0 },
      cellMap: {},
    };

    this.onDragStart = undefined;
    this.onDragging = undefined;
    this.onDragEnd = undefined;

    this.init();
  }

  get info() {
    const {
      startPoint: { row: startRow, col: startCol },
      endPoint: { row: endRow, col: endCol },
      cellMap,
    } = this.__mouse_drag_info__;

    const __start_point__ = {
      row: Math.min(startRow, endRow),
      col: Math.min(startCol, endCol),
    };

    const __end_point__ = {
      row: Math.max(startRow, endRow),
      col: Math.max(startCol, endCol),
    };

    const { startPoint, endPoint } = this.getStartEndPoint(
      __start_point__,
      __end_point__
    );

    // 允许反方向拖动，自动校正起（左上）止（右下）点
    return {
      ...this.__mouse_drag_info__,
      startPoint,
      endPoint,
      cellArr: Object.values(cellMap),
      cellIdArr: Object.keys(cellMap),
    };
  }

  set info(value) {
    this.__mouse_drag_info__ = {
      ...this.__mouse_drag_info__,
      ...value,
    };
  }

  init() {
    let dragFlag = false;
    const activeCellFn = throttle(this.activateCell, 200, this);

    this.tableContainer.addEventListener("mousedown", (e) => {
      // 右键点击无效
      if (e.button === 2) {
        e.preventDefault();
        return;
      }

      const { row, col, rowspan, colspan, id, cell } = getCellInfo(
        this.tableContainer,
        e
      );

      // 如果点击的是表头无效
      if (row === undefined) {
        return;
      }

      if (this.onDragStart) {
        this.onDragStart();
      }

      dragFlag = true;

      this.info.cellArr.forEach((cell) => {
        cell.classList.remove("highlight");
      });

      this.info = {
        startPoint: { row, col, rowspan },
        endPoint: { row, col, rowspan },
        col,
        cellMap: { [id]: cell },
      };
    });

    this.tableContainer.addEventListener("mousemove", (e) => {
      if (dragFlag) {
        if (this.onDragging) {
          this.onDragging();
        }

        const { row, col, rowspan } = getCellInfo(this.tableContainer, e);

        this.info = { endPoint: { row, col, rowspan } };

        activeCellFn();
      }
    });

    this.tableContainer.addEventListener("mouseup", (e) => {
      if (this.onDragEnd) {
        this.onDragEnd();
      }
      dragFlag = false;
    });
  }

  // 激活单元格
  activateCell() {
    const prevCellMap = { ...this.info.cellMap };
    const currCellMap = {};

    const { row: startRow, col: startCol } = this.info.startPoint;
    const { row: endRow, col: endCol } = this.info.endPoint;

    for (let row = startRow; row <= endRow; row++) {
      const tbodyRow = this.tableContainer.querySelectorAll("tbody tr")[row];
      const cells = tbodyRow.querySelectorAll("td");

      for (let col = startCol; col <= endCol; col++) {
        const cell = cells[col];

        if (!cell.classList.contains("placeholder")) {
          const id = cell.dataset.id;
          currCellMap[id] = cell;
        }
      }
    }

    const prevCellMapIds = Object.keys(prevCellMap);
    const currCellMapIds = Object.keys(currCellMap);

    currCellMapIds.forEach((currId) => {
      const currCell = currCellMap[currId];
      if (!currCell.classList.contains("highlight")) {
        currCell.classList.add("highlight");
      }
    });

    prevCellMapIds.forEach((prevId) => {
      if (!currCellMapIds.includes(prevId)) {
        prevCellMap[prevId].classList.remove("highlight");
      }
    });

    this.info = { cellMap: currCellMap };
  }

  getStartEndPoint(startPoint, endPoint) {
    const { row: startRow, col: startCol } = startPoint;
    const { row: endRow, col: endCol } = endPoint;

    let spanStartRow = startRow;
    let spanStartCol = startCol;
    let spanEndRow = endRow;
    let spanEndCol = endCol;

    for (let row = startRow; row <= endRow; row++) {
      const tbodyRow = this.tableContainer.querySelectorAll("tbody tr")[row];
      const cells = tbodyRow.querySelectorAll("td");

      for (let col = startCol; col <= endCol; col++) {
        const cell = cells[col];

        if (!cell.classList.contains("placeholder")) {
          const { rowspan, colspan, row, col } = getCellInfo(
            this.tableContainer,
            cell
          );

          const spanCellRow = row + rowspan - 1;
          const spanCellCol = col + colspan - 1;

          spanStartRow = Math.min(spanStartRow, spanCellRow);
          spanEndRow = Math.max(spanEndRow, spanCellRow);
          spanStartCol = Math.min(spanStartCol, spanCellCol);
          spanEndCol = Math.max(spanEndCol, spanCellCol);
        }
      }
    }

    return {
      startPoint: { row: spanStartRow, col: spanStartCol },
      endPoint: { row: spanEndRow, col: spanEndCol },
    };
  }
}

// 自定义鼠标右键菜单
class RightMouseButtonMenu {
  constructor() {
    this.menu = undefined;
    this.__menu_event_listener__ = undefined;
  }

  showMenu(x, y, menuOptions) {
    this.hideMenu();

    const menuWrapper = document.createElement("ul");
    menuWrapper.id = "menu-wrapper";

    let menuItems = "";
    menuOptions.forEach((option) => {
      if (option.role === "insert-down") {
        menuItems += `<li class="menu-item" data-role="${option.role}">${option.label} <input type="number" value="1" /> 行</li>`;
        return;
      }
      if (option.role === "insert-right") {
        menuItems += `<li class="menu-item" data-role="${option.role}">${option.label} <input type="number" value="1" /> 列</li>`;
        return;
      }

      menuItems += `<li class="menu-item" data-role="${option.role}">${option.label}</li>`;
    });

    menuWrapper.innerHTML = menuItems;
    menuWrapper.style.display = "block";
    menuWrapper.style.top = `${y}px`;
    menuWrapper.style.left = `${x - 50 < 0 ? 0 : x - 50}px`;

    document.body.appendChild(menuWrapper);

    this.menu = menuWrapper;

    this.handleMenuEvent();
  }

  hideMenu() {
    if (this.menu) {
      this.menu.style.display = "none";
      this.menu.remove();
      this.menu = undefined;
    }
  }

  addMenuEventListener(value) {
    this.__menu_event_listener__ = value;
  }

  handleMenuEvent() {
    this.menu.addEventListener("mousedown", (e) => {
      if (e.target instanceof HTMLInputElement) {
        return;
      }

      if (this.__menu_event_listener__) {
        const eventType = e.target.dataset.role;

        const input = e.target.querySelector("input");
        const value = input ? Number(input.value) : undefined;

        this.__menu_event_listener__(eventType, value);
      }
    });
  }
}

// 获取单元格信息
function getCellInfo(tableContainer, tableCell) {
  const currCell = tableCell.target || tableCell;
  const { id, rowspan = 1, colspan = 1 } = currCell.dataset || {};

  const tbodyRows = tableContainer.querySelectorAll("tbody tr");

  let row = undefined;
  let col = undefined;

  for (let i = 0; i < tbodyRows.length; i++) {
    const colIndex = Array.from(tbodyRows[i].querySelectorAll("td")).indexOf(
      currCell
    );

    if (colIndex > -1) {
      row = i;
      col = colIndex;
    }
  }

  return {
    row,
    col,
    rowspan: Number(rowspan),
    colspan: Number(colspan),
    id,
    cell: currCell,
    className: currCell.className,
    value: currCell.innerText,
  };
}

function getUuidCode() {
  //64长度
  var len = 64;
  //16进制
  var radix = 16;
  var chars =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
  var uuid = [],
    i;
  radix = radix || chars.length;
  if (len) {
    for (i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
  } else {
    var r;
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
    uuid[14] = "4";
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | (Math.random() * 16);
        uuid[i] = chars[i == 19 ? (r & 0x3) | 0x8 : r];
      }
    }
  }
  return uuid.join("");
}

function throttle(fn, wait, _this) {
  let timer = null;
  let prev = new Date();
  return function () {
    let nowTime = new Date();
    // 获取当前时间，转换成时间戳，单位毫秒
    let context = _this || this;
    clearTimeout(timer);
    // ------ 新增部分 start ------
    // 判断上次触发的时间和本次触发的时间差是否小于时间间隔
    // 如果小于，则为本次触发操作设立一个新的定时器
    // 定时器时间结束后执行函数 fn
    if (nowTime - prev > wait) {
      fn.apply(context, arguments);
      prev = new Date();
      // ------ 新增部分 end ------
    } else {
      timer = setTimeout(() => {
        fn.apply(context, arguments);
      }, wait);
    }
  };
}
