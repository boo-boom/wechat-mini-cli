const path = require('path')
const fs = require('fs-extra')
const program = require('commander')
const inquirer = require('inquirer')
const ora = require('ora')
const pug = require('pug')
const loading = ora('Loading unicorns')
const download = require('download-git-repo')
const { version, binName } = require('./package.json')

class WechatCli {
  constructor() {
    this.rootPath = process.cwd()
    this.pagesPath = path.resolve(this.rootPath, 'pages')
    this.componentsPath = path.resolve(this.rootPath, 'components')
    this.typeAnswer = {}
  }

  init() {
    program
      .version(version, '-v, --version', '版本')
      .helpOption('-h, --help', '帮助')
      .addHelpCommand('help [command]', '显示指令帮助')
      .name(binName)
      .usage('<指令>')
      .command('create')
      .description('创建页面/组件')
      .action(async () => {
        const answer = await this.getAnswer()

        if (answer) {
          this.createTemplate(answer)
  
          loading.text = '疯狂加载中'
          loading.color = 'green'
          loading.start()
        }
      })

    program.parse(process.argv)
  }

  async getAnswer() {
    const isWxMiniRoot = fs.pathExistsSync(`${this.rootPath}/sitemap.json`)
    if (!isWxMiniRoot) {
      const isNext = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'next',
          message: '当前目录可能不是小程序项目根目录，是否继续创建？',
        }
      ])
      if (!isNext.next) {
        return null
      } else {
        const pagesExist = fs.pathExistsSync(this.pagesPath)
        const componentsExist = fs.pathExistsSync(this.componentsPath)
        if (!pagesExist) fs.mkdirSync(this.pagesPath)
        if (!componentsExist) fs.mkdirSync(this.componentsPath)
      }
    }


    let answer
    this.typeAnswer = await inquirer.prompt([
      {
        type: 'list',
        message: '选择创建页面/组件',
        name: 'type',
        choices: ['page', 'component'],
      },
    ])

    if (this.typeAnswer.type === 'page') {
      answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入页面名称',
          filter(value) {
            return value.trim()
          },
          validate: (value) => {
            if (!value) {
              return '请输入名称'
            } else {
              const dirPath = `${this.pagesPath}/${value}`
              const hasFile = fs.existsSync(dirPath)
              if (hasFile) {
                return '该页面已存在，请更改名称。'
              } else {
                return true
              }
            }
          },
        },
        {
          type: 'checkbox',
          message: '选择初始化页面配置:',
          name: 'pageInit',
          choices: [
            {
              name: '页面分享',
              value: 'onShareAppMessage',
            },
            {
              name: '下拉事件',
              checked: true, // 默认选中
              value: 'onPullDownRefresh',
            },
            {
              name: '上拉事件',
              value: 'onReachBottom',
            },
          ],
        },
      ])
    } else {
      answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入组件名称',
          filter(value) {
            return value.trim()
          },
          validate: (value) => {
            if (!value) {
              return '请输入名称'
            } else {
              const dirPath = `${this.componentsPath}/${value}`
              const hasFile = fs.existsSync(dirPath)
              if (hasFile) {
                return '该组件已存在，请更改名称。'
              } else {
                return true
              }
            }
          },
        },
      ])
    }

    return answer
  }

  createTemplate(answer) {
    const { name, pageInit = [] } = answer
    const dirPath = this.typeAnswer.type === 'page' ? `${this.pagesPath}/${name}` : `${this.componentsPath}/${name}`
    const tempPath = 'pagesTemplate/template'
    const tempDir = path.resolve(__dirname, 'pagesTemplate')

    this.removeDir()

    loading.color = 'green'
    loading.text = '正在疯狂加载中'
    loading.start()

    const hasDir = fs.existsSync(tempDir)
    !hasDir && fs.mkdirSync(tempDir)

    
    download(`boo-boom/wechat-file-template#${this.typeAnswer.type === 'page' ? 'pageTemplate' : 'componentTemplate'}`, './pagesTemplate', { clone: true }, error => {
      if(error){
        loading.fail(`创建失败: ${error.message}`)
      } else {
        loading.color = 'blue'
        loading.text = '开始创建模版'
        loading.start()
        
        // 创建.js模版
        const jsStr = pug.renderFile(path.resolve(__dirname, `./${tempPath}/js.pug`), {
          shareTitle: name,
          sharePath: `/pages/${name}/${name}`,
          pageInit,
        })
        const jsTemp = jsStr.replace(/(^\<div\>)|(\<\/div\>$)/gi, '')
        // 创建.wxml模版
        const wxmlTemp = pug.renderFile(path.resolve(__dirname, `./${tempPath}/wxml.pug`), {
          name,
        })
        // 创建.wxss模版
        const wxssTemp = pug.renderFile(path.resolve(__dirname, `./${tempPath}/wxss.pug`))
        // 创建.json模版
        const jsonTemp = fs.readJSONSync(path.resolve(__dirname, `./${tempPath}/temp.json`))
        if (pageInit.length) {
          pageInit.forEach(item => {
            switch (item) {
              case 'onPullDownRefresh':
                jsonTemp['enablePullDownRefresh'] = true
                break
              case 'onReachBottom':
                jsonTemp['onReachBottomDistance'] = true
                break
            }
          })
        }

        // 创建文件
        fs.mkdirSync(dirPath)
        fs.writeFileSync(`${dirPath}/${name}.js`, jsTemp)
        fs.writeFileSync(`${dirPath}/${name}.wxml`, wxmlTemp)
        fs.writeFileSync(`${dirPath}/${name}.wxss`, wxssTemp)
        fs.writeJsonSync(`${dirPath}/${name}.json`, jsonTemp, { spaces: '\t'})

        this.updateAppJson(name)
        loading.succeed(`成功了同学`)
      }
      this.removeDir()
    })
  }

  updateAppJson(name) {
    const appJson = fs.readJSONSync(path.resolve(this.rootPath, './app.json'))
    const pagePath = `pages/${name}/${name}`
    if(!appJson.pages.includes(pagePath)) {
      appJson.pages.push(pagePath)
    }
    fs.writeJsonSync(path.resolve(this.rootPath, './app.json'), appJson, { spaces: '\t'})
  }

  removeDir() {
    fs.emptyDir(path.resolve(__dirname, './pagesTemplate'))
  }
}

module.exports = {
  WechatCli,
}
